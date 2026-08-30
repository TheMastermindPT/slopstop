---
date: 2026-08-26T17:25:29+0100
author: Pedro Mesquita
commit: 3fb0760
branch: decision/ticket-78-evidence-limits
repository: slopstop-ticket-78
topic: "Measured Evidence result-size limits for issue 78"
tags: [research, evidence, limits, convergence]
status: complete
last_updated: 2026-08-26T17:25:29+0100
last_updated_by: Pedro Mesquita
content_hash: 708d5ad749e3577c6dddbfc18a9fdad68b428984864c69c6cfbc937b9704aa2c
---

# Research: Measured Evidence Result-Size Limits

## Research Question

What measured byte, row, member, path, conflict, anchor, and evaluation-time limits should govern each Evidence result family? Gather representative local workload evidence, preserve explicit truncation rather than false completeness, and recommend versioned defaults, override authority, and exhaustion diagnostics for GitHub issue [#78](https://github.com/TheMastermindPT/slopstop/issues/78), which blocks the Convergence proof-bundle decision in [#75](https://github.com/TheMastermindPT/slopstop/issues/75).

## Summary

SlopStop has enough local repository history to choose safe **provisional local** new-Artifact-byte and path ceilings, but not enough data to claim production defaults for inline payload, rows, semantic members, conflicts, anchors, or evaluator time. The recommended starting point is immutable profile `evidence-result-limits/0.1.0-local-balanced`: 256 KiB inline payload, 2 MiB newly produced result Artifacts, 2,048 normalized rows, 512 semantic members, 256 distinct paths, 256 conflicts, 512 anchor references, 64 candidates per resolved anchor, and 30 seconds of deterministic evaluator time. Every family uses only the dimensions it directly materializes.

The profile is deliberately a blocking safety bound, not a promise that workloads fit. Reaching a production data bound yields the family's exact truncation outcome with exact exhaustion diagnostics; Candidate review uses `CANDIDATE_BLOCKED` with blocker kind `truncated`, while other families use their truncated verdict. Reaching deterministic evaluator time yields the family's broken verdict because no trustworthy evaluation completed. Missing, truncated, ambiguous, uncertain, and broken inputs never become empty, clean, complete, or applicable (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:332-333`).

The main architectural gap at the measured commit is override authority outside a Run. ADR 0010 permits an approved-limit dependency owned only by a Delegation-plan revision or Run-policy epoch (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:324-326,413`), but `effect` and `artifact-state` also cover Project operations, and Integration-target capture can occur under Integration authority. Implementation must not invent a fake Run. ADR 0019 later closes this gap with exact Effect-declaration and Integration owner arms.

## Detailed Findings

### 1. Reproducible Methodology

#### Repository snapshot

- Worktree: `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-ticket-78`
- Branch: `decision/ticket-78-evidence-limits`
- Commit: `3fb07604b406b785c671a8cfd49e504c880a8996`
- The worktree was clean before and after measurement.
- SlopStop has no production Evidence runtime or customer benchmark corpus. The product record explicitly says no customer claims or benchmarks exist (`PRODUCT.md:124-133`).

#### File sample

The tracked-file population came from:

```text
git ls-files -z
```

For every returned path, the measurement recorded filesystem byte length, normalized path character count, slash-delimited component count, extension, and decoded line count. The sample includes all 159 tracked files at the stated commit; generated dependencies and untracked files are excluded.

#### Git history sample

The commit population came from:

```text
git rev-list --reverse HEAD
git show --root --format= --diff-merges=first-parent --numstat --find-renames <sha>
git show --root --format= --diff-merges=first-parent --binary --no-color --no-ext-diff --find-renames <sha>
```

The sample covers all 43 commits: 17 merges and one root commit. Merge measurements use first-parent diff semantics. Patch bytes are the exact byte length of the emitted binary-safe Git patch, including patch metadata. `numstat` supplied added/deleted lines and changed-path entries. No binary path entry occurred. The root commit is reported both inside the complete population and excluded as a bootstrap outlier.

#### Runtime proxies

```text
pnpm exec vitest run --coverage --coverage.reporter=text --coverage.reportsDirectory="C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-ticket-78-coverage"
likec4 validate --json --no-layout docs/architecture
```

Vitest passed 15 files and 92 tests in 9.37 seconds. This is one whole-suite wall-clock observation, not a per-family Evidence evaluator benchmark. LikeC4 validated three architecture files with zero errors; the model declares 15 elements.

#### Quantiles

All reported percentiles use the Type-7 linear estimator used by common statistical tools: sort ascending, compute index `(n - 1) * p`, then linearly interpolate between adjacent values. Decimal percentiles are retained rather than silently rounded. Recommended binary ceilings are rounded upward only after applying the stated headroom rule.

### 2. Measured Local Workload

#### Tracked files

| Measure | n | Min | Median | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| File bytes | 159 | 8 | 2,602 | 55,463.1 | 298,385 |
| Path characters | 159 | 9 | 37 | 83 | 96 |
| Path components | 159 | 1 | 3 | 6 | 6 |
| Text lines | 159 | 1 | 69 | 532 | 9,067 |

The 159 files total 2,082,230 bytes. The largest tracked file is `pnpm-lock.yaml` at 298,385 bytes and 9,067 lines. Top-level concentrations are `apps/` with 65 files, `.rpiv/` with 26, `docs/` with 23, and `packages/` with 14.

#### Complete commit history

| Measure | n | Min | Median | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Changed paths | 43 | 1 | 8 | 37.4 | 99 |
| Added lines | 43 | 3 | 389 | 8,153.6 | 13,845 |
| Deleted lines | 43 | 0 | 18 | 127.4 | 180 |
| Churn lines | 43 | 4 | 440 | 8,288.6 | 13,845 |
| Patch bytes | 43 | 1,771 | 132,237 | 321,126.4 | 589,386 |

#### Commit history excluding the root commit

| Measure | n | Min | Median | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Changed paths | 42 | 1 | 7 | 31.5 | 42 |
| Added lines | 42 | 3 | 389 | 6,883.45 | 10,998 |
| Deleted lines | 42 | 0 | 24 | 128.7 | 180 |
| Churn lines | 42 | 4 | 429 | 7,056.2 | 11,178 |
| Patch bytes | 42 | 1,771 | 127,822 | 299,062.5 | 517,844 |

Across history there are 480 changed-path entries. Per-path churn has `n=480`, minimum 1, median 21.5, P95 451.65, and maximum 7,818 lines.

#### Current schema and fixture evidence

- The current Workspace protocol has 11 `z.array(...)` fields without numeric `.max(...)` bounds. Its opaque cursor has only a non-empty constraint (`packages/protocol/src/workspace-protocol.ts:73-100,119-123,147-159`).
- Context records already distinguish `complete` from `truncated`, but carry no numeric limit or omitted count (`packages/protocol/src/workspace-protocol.ts:217-227`). This is a useful semantic precedent, not an Evidence implementation.
- The renderer prototype is explicitly fixture-backed and owns no Evidence or canonical authority (`.rpiv/artifacts/validation/2026-08-25_23-26-11_workspace-supervision-prototype.md:14-19`).
- No typed runtime Finding, Compound-code-anchor, Composition-conflict, or Evidence-result fixture exists. The only conflict-like prototype sentence is presentation data, so it cannot size domain limits.

#### What the sample supports

The measured headroom rule for a scalar with a real local population is:

```text
nextPowerOfTwo(max(4 * p95, 2 * observedMax))
```

- Patch bytes produce 2 MiB: `max(4 * 321,126.4, 2 * 589,386)` rounds up to 2,097,152 bytes.
- Changed paths produce 256: `max(4 * 37.4, 2 * 99)` rounds up to 256.
- A 512-member provisional ceiling is above twice the complete tracked-file population (`2 * 159 = 318`) and 5.57 times the current 92-test population, but member semantics are not directly measured.
- Row, conflict, anchor, and evaluator-time values are conservative engineering floors, not measured percentiles. They must remain labelled low confidence.

### 3. Dimensions Per Evidence Family

ADR 0010 defines 16 closed Evidence families and prohibits later families from borrowing their verdicts (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:15-20`). The family table below assigns only direct materialization limits. A reference to an already bounded immutable dependency does not spend its path, conflict, or anchor limit again, but the reference row and aggregate member still spend the consuming result's row/member limits.

| Evidence family | Inline bytes | New Artifact bytes | Rows | Members | Paths | Conflicts | Anchors | Candidates per anchor | Evaluator time |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
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

The shared dimensions mean:

| Dimension | Exact counting rule |
| --- | --- |
| Inline bytes | Canonical encoded bytes newly stored in the observation/evaluation payload and typed children, excluding pre-existing referenced rows. |
| Result Artifact bytes | Sum of expected byte lengths for newly produced Artifacts owned by this result. A referenced pre-existing Artifact is not counted again. |
| Rows | Every family-owned normalized payload, child, member-link, family-native omission, and family-native diagnostic row newly created for the result. Common envelope/current-pointer rows and the separate limit-usage/exhaustion metadata are excluded. |
| Members | The family-specific closed semantic-member identities later fixed by ADR 0019. Each canonical member-kind, domain identity, and version-or-position tuple is unique within one result. |
| Paths | Distinct normalized Repository-relative path identities materialized by the result. A rename spends both source and destination path identities. |
| Conflicts | Distinct immutable typed conflict records. Conflict-to-member and conflict-to-path links also spend rows. |
| Anchors | Distinct Compound-code-anchor references materialized by an aggregate result. `anchor-resolution` additionally limits ordered candidates per one anchor. |
| Evaluator time | Monotonic wall-clock time inside the deterministic Evidence evaluator after all inputs are locally available. It excludes producer, process, Language-server, remote-reconciler, test-command, and queue time, each of which retains its own approved timeout/budget. |

Every producer records `limit_policy_id`, immutable version and fingerprint, approved owner, dimension, ceiling, retained count/bytes, and a deterministic exhaustion position. If total omissions are known, it records an exact omitted count. If enumeration stopped to respect time or cost, it records an `at-least` omitted lower bound; it must not continue unbounded work merely to make the diagnostic exact.

### 4. Confidence Limits

| Claim | Confidence | Reason |
| --- | --- | --- |
| 256 KiB inline payload is adequate | Very low | No canonical Evidence payload corpus exists. This is an engineering placeholder, not an output-byte percentile. |
| 2 MiB result-Artifact ceiling fits current repository-sized outputs | Medium | 3.56 times the largest historical patch and 7.03 times the largest tracked file, but only one repository was measured. |
| 256 paths fits current repository changes | Medium | 2.59 times the all-history maximum changed-path count and greater than the current 159-file repository. |
| 512 semantic members is adequate | Low | Tracked files and tests are proxies; no Evidence family member population exists. |
| 2,048 normalized rows is adequate | Low | There are no persisted Evidence result rows. The value is a conservative floor, not a percentile. |
| 256 conflicts is adequate | Very low | No real Composition conflict corpus exists; conflict density can grow faster than path count. |
| 512 anchors and 64 candidates per anchor are adequate | Very low | No implemented Compound-code-anchor resolver or fixture corpus exists. |
| 30-second deterministic evaluator time is adequate | Very low | The only runtime proxy is a 9.37-second whole test suite, which measures different work. |
| Failure/truncation semantics and authority boundaries are stable | High | Accepted ADRs explicitly define typed truncation, broken states, limit dependencies, and owner boundaries. |

These numbers must not be called production defaults. Keep the policy prerelease/local until there are at least 200 results for each active family across at least five materially different repositories; that gives roughly ten observations in a P95 tail. A P99 claim requires at least 1,000 exact samples for each claimed family and applicable dimension; censored lower bounds do not enter the percentile. These are promotion gates for confidence, not claims that repository count alone creates representativeness.

Telemetry must record counts and elapsed values even when far below the cap, plus whether the cap was hit. It must contain no prompts, source text, model output, secrets, environment values, or full local paths, consistent with the repository privacy rules. Store only typed counts, coarse sizes/timings, family/policy versions, scope kind, and redacted repository cohort identifiers.

### 5. Policy And Test Scenarios

Only `0.1.0-local-balanced` is a runtime product-policy entry. Strict and Headroom below are immutable test scenarios used to prove truncation and approval behavior; they are not selectable catalogue policies and grant no authority. A runtime binding always persists the accepted Balanced policy identity/version/fingerprint and one resolved-values fingerprint. Values above Balanced additionally require the exact direct owner and separate headroom approval; they do not create or replace the policy.

| Limit | `0.1.0-local-strict` | `0.1.0-local-balanced` | `0.1.0-local-headroom` |
| --- | ---: | ---: | ---: |
| Inline payload bytes | 131,072 (128 KiB) | **262,144 (256 KiB)** | 524,288 (512 KiB) |
| New result Artifact bytes | 1,048,576 (1 MiB) | **2,097,152 (2 MiB)** | 4,194,304 (4 MiB) |
| Normalized rows | 1,024 | **2,048** | 8,192 |
| Semantic members | 256 | **512** | 2,048 |
| Distinct paths | 128 | **256** | 512 |
| Conflicts | 64 | **256** | 1,024 |
| Anchor references | 256 | **512** | 2,048 |
| Candidates per anchor | 32 | **64** | 128 |
| Deterministic evaluator time | 15 s | **30 s** | 60 s |

Option assessment:

1. **Strict** is suitable only for deliberate truncation tests, including fixtures that simulate constrained machines. It still fits the largest historical patch, but its 128-path cap does not leave enough room for twice the current 159-file repository.
2. **Balanced** is the recommended local default. Its bytes and paths are derived from the measured rule; other dimensions are cautious placeholders with explicit low confidence.
3. **Headroom** is not an automatic fallback or runtime profile-name selection. Tests may use the scenario values. Production headroom requires explicit resolved values and an attributed user decision in the exact Delegation-plan, Run-policy-epoch, Effect-declaration, Integration-applicability-request, or Integration-approval owner.

Do not provide `unlimited`, `0 means unlimited`, environment-variable bypasses, producer-selected widening, or automatic retry with a larger profile. The Capability contract fixes representable limit units (`docs/adr/0016-language-observation-intake-and-evidence-authority.md:41-46`), and an added or relaxed limit is added power requiring another approved Run epoch (`docs/adr/0011-approved-run-preparation-and-amendment-authority.md:164-169`).

#### Override authority

- **Run-bound families:** the sealed Run approval proposal resolves the selected policy version and any family value into one complete limits fingerprint. The exact Delegation-plan revision or Run-policy epoch is the direct owner. A relaxed value requires its explicit attributed user decision and, when applicable, a newly approved epoch; retries never reset consumed cumulative limits.
- **Project-operation families:** the exact Effect declaration owns the policy and values for its non-Run Effect and directly requested Artifact-state Evidence. Initial Artifact state uses a family-specific binding to the producing operation's direct owner. Recovery remains Run-only, and standalone background Artifact-state scans remain unsupported without a later owner decision. The external Storage-operation partition records the same immutable tuple beside its operation journal.
- **Integration families:** the exact Integration applicability request owns the first read-only target capture and applicability evaluation. The exact Integration approval owns preparation, pre-apply capture, and apply reconciliation.
- **Capability ceiling:** a Capability may set a lower hard representational maximum. Admission fails explicitly when the selected profile cannot be represented; the system never weakens the request (`docs/adr/0016-language-observation-intake-and-evidence-authority.md:43-46`).
- **Producer and evaluator:** neither may widen, reinterpret, or auto-select a different limit. They report use and exhaustion only.
- **Convergence:** receives the exact policy identity, counters, omissions, and family verdicts in the immutable proof bundle. It cannot override them or convert partial input to complete authority.
- **Direct-owner union:** ADR 0019 closes the prior non-Run gap with the five owner arms above. A generic Application/Project profile or fake Run-policy dependency is prohibited.

Any changed limit fingerprint reverse-invalidates exact dependent current evaluations. A narrower live ceiling may close future dispatch immediately, but favorable reuse still requires evaluation under the newly accepted key; an older favorable result is not silently relabelled.

### 6. Exhaustion Semantics And Diagnostics

#### Result-production exhaustion

When the next required byte, row, member, path, conflict, anchor, or anchor candidate would exceed a ceiling:

1. Stop retaining new material at the deterministic boundary.
2. Preserve the ordered retained prefix or otherwise contract-defined deterministic subset and its Artifacts.
3. Record `EVIDENCE_RESULT_LIMIT_EXHAUSTED` with dimension, policy identity/version/fingerprint, approved owner, subject, scope, producer attempt, ceiling, retained amount, observed amount, exact or lower-bound omissions, first omitted ordinal when known, and elapsed time.
4. Emit the family's exact truncation outcome. Candidate review emits `CANDIDATE_BLOCKED` with blocker kind `truncated`; other examples include `FINGERPRINT_TRUNCATED`, `WORKER_DELTA_TRUNCATED`, `TEST_TRUNCATED`, `FINDING_TRUNCATED`, `RECHECK_TRUNCATED`, `EFFECT_TRUNCATED`, `RECOVERY_BLOCKED_TRUNCATED`, `LANGUAGE_OBSERVATION_TRUNCATED`, `COMPOSITION_TRUNCATED`, `TARGET_FINGERPRINT_TRUNCATED`, `INTEGRATION_TRUNCATED`, `ANCHOR_TRUNCATED`, and ADR 0019's `ARTIFACT_STATE_TRUNCATED` (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:67-258,291-305`).
5. Block every favorable consumer. Useful partial rows remain inspectable but grant no complete authority.

If a family lacks an exact family-owned truncation outcome for a dimension it can directly exhaust, that is a schema defect to resolve before implementation; do not map exhaustion to missing, empty, rejected, or broken merely for convenience. Candidate review deliberately uses `CANDIDATE_BLOCKED` with blocker kind `truncated`; it is not required to add a redundant verdict.

#### Evaluator-time exhaustion

Deterministic evaluator time starts only after complete producer input is locally available. If it expires, no trustworthy evaluation completed. Emit `EVIDENCE_EVALUATOR_TIME_EXHAUSTED` with the same policy and counter fields, then use the family's broken verdict. `TEST_TIMED_OUT` belongs to the test process; `LANGUAGE_OBSERVATION_UNCERTAIN` may describe producer continuity; neither should hide an Evidence evaluator timeout.

#### Distinct cumulative exhaustion

Do not confuse result-size exhaustion with bounded attempts or budgets:

- Repeated conflict-resolution lineage uses `CANDIDATE_CONFLICT_REPEATED` and remains blocked; the later epoch cannot reset attempts already consumed (`docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:65-70`).
- Finding remediation/validation exhaustion uses `FINDING_REMEDIATION_EXHAUSTED`, closes affected dispatch, preserves all Findings and Evidence, and creates Attention (`docs/adr/0014-finding-validation-remediation-and-recheck-authority.md:95-102`).
- A Capability that cannot represent the requested limit rejects admission before producer work. It is not a truncated result.

The standing decision is consistent: absence and failure are different, and a broken gate never reports clean (`.rpiv/decisions/degrade-distinguishes-broken.md:12-24`).

### 7. Dependency-Ordered Decision Tree And Recommendation

1. **Is the target a local provisional profile or a production claim?** Choose `0.1.0-local-balanced` now. If production, first collect family telemetry; current data cannot justify that label.
2. **Is the Evidence subject entirely Run-bound?** If yes, use the accepted Delegation-plan or Run-policy-epoch rule. If no, use ADR 0019's exact Effect-declaration, Integration-applicability-request, or Integration-approval arm; never invent a Run.
3. **Can the selected Capability represent every dimension and ceiling?** If no, reject admission with the Capability diagnostic. Do not downgrade the operation or silently pick Strict.
4. **Does a measured workload require more than Balanced?** If no, keep Balanced. If yes, show the expected family/dimension use and obtain the next immutable approved authority; Headroom is never automatic.
5. **Did production stop on bytes/rows/members/paths/conflicts/anchors?** Preserve the partial result, emit `EVIDENCE_RESULT_LIMIT_EXHAUSTED`, and accept the exact family truncation outcome. Candidate review uses `CANDIDATE_BLOCKED` plus blocker kind `truncated`; other families use their truncated verdict. Never infer empty or complete.
6. **Did the deterministic evaluator exceed 30 seconds?** Emit `EVIDENCE_EVALUATOR_TIME_EXHAUSTED` and use the family broken verdict. Diagnose or version the evaluator before widening time.
7. **Did a cumulative attempt/budget exhaust instead?** Use the specialized Finding or conflict-lineage blocked condition; do not call the Evidence result truncated.
8. **Did the policy version change?** Create a new immutable policy and fingerprint. **Did only headroom values change?** Keep the policy identity, create a fresh direct owner and headroom approval, and bind a new resolved-values fingerprint. In both cases reverse-invalidate exact dependants; never mutate or relabel old current Evidence.
9. **Has the telemetry promotion gate been reached?** Recompute distributions per family and dimension, publish a new immutable policy version, and retain `0.1.0-local-balanced` for historical evaluations.

**Recommendation:** accept `evidence-result-limits/0.1.0-local-balanced` as the implementation and fixture default, explicitly marked provisional and local. Use one profile shape across all 16 families, with the applicability matrix in section 3. Add deterministic truncation tests at every applicable dimension, plus one evaluator-time broken test per family. Issue #75 should reference the exact policy version/fingerprint and carry retained/omitted counters; a proof bundle containing any required truncated family member remains incomplete.

### Decision Resolution

ADR 0019 accepts the recommendation and closes the authority gap. It selects direct owners `delegation-plan`, `run-policy-epoch`, `effect-declaration`, `integration-applicability-request`, and `integration-approval`; adds `ARTIFACT_STATE_TRUNCATED`; separates data exhaustion from evaluator timeout; requires explicit operation-specific headroom; adds the first strictly local read-only Integration applicability capture before approval; and fixes the promotion gates at 200 terminal results per active family across five materially different repositories, with 1,000 exact samples per claimed family and applicable dimension for a P99 claim.

## Code References

- `PRODUCT.md:17-23` — User need and requirement that failed or unknown checks never appear clean.
- `PRODUCT.md:124-133` — No customer claims or benchmark corpus exists.
- `CONTEXT.md:82-103` — Evidence family, envelope, evaluation, scope, Artifact, and evaluator vocabulary.
- `CONTEXT.md:137-168` — Compound anchors, fingerprints, Candidate/Integration, Process-job, and Language-observation vocabulary.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:15-20` — Closed 16-family set and owner boundaries.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:46-65` — Typed record boundaries for every family.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:307-333` — Complete evaluation key, approved limits, invalidation, and failure preservation.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:335-356` — Bounded Artifact identity, truncation-at-production, state, and retention.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:413` — Current two-arm approved-limit owner dependency.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:520` — Numeric result-size limits were explicitly deferred.
- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:45-53` — Sealed proposal budget/limit values and fingerprint.
- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:164-169` — Live ceilings and relaxed-limit approval rule.
- `docs/adr/0013-effect-reconciliation-and-recovery-journal.md:149-169` — Bounded reconcilers and completeness requirements by effect class.
- `docs/adr/0014-finding-validation-remediation-and-recheck-authority.md:95-102` — Exact remediation limits and exhaustion behavior.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:52-76` — Composition members, conflicts, cumulative resolution bound, and Candidate review limits.
- `docs/adr/0016-language-observation-intake-and-evidence-authority.md:25-31` — Language check/request/attempt identity and limits.
- `docs/adr/0016-language-observation-intake-and-evidence-authority.md:41-60` — Capability limit units, chunks, member counts, and complete empty output.
- `docs/adr/0016-language-observation-intake-and-evidence-authority.md:64-85` — Language truncation, evaluation, and invalidation semantics.
- `packages/protocol/src/workspace-protocol.ts:73-100` — Current unbounded cursor-bearing Workspace queries.
- `packages/protocol/src/workspace-protocol.ts:119-159` — Current arrays have identity checks but no numeric maxima.
- `packages/protocol/src/workspace-protocol.ts:217-227` — Existing complete/truncated projection precedent.
- `.rpiv/decisions/degrade-distinguishes-broken.md:12-24` — Standing rule that broken never degrades to absent or clean.

## Integration Points

### Inbound References

- `docs/adr/0011-approved-run-preparation-and-amendment-authority.md:45-53` — Run approval seals limits and their canonical fingerprint.
- `docs/adr/0012-test-first-completion-proof.md:18-19` — Behavior and Test contracts own relevant limits and failure behavior.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:37-40` — Composition inputs bind limits before physical work.
- `docs/adr/0016-language-observation-intake-and-evidence-authority.md:25-31` — Language requests bind exact approved limits and timeout.

### Outbound Dependencies

- GitHub issue `#75` — Convergence proof-bundle identity, completeness, member order, limits, and invalidation consume this policy without receiving authority.
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:324-330` — A changed limit dependency reverse-invalidates current Evidence.
- `docs/adr/0014-finding-validation-remediation-and-recheck-authority.md:135-141` — Completion Finding snapshots require complete non-truncated input.
- `docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md:86-97` — Integration applicability and apply consume complete target and Candidate Evidence.

### Infrastructure Wiring

No production Evidence schema, evaluator registry, Artifact store, or family runtime is implemented at this commit. The current implementation boundary is the Workspace protocol, and its Context truncation marker is not reusable as Evidence authority (`packages/protocol/src/workspace-protocol.ts:217-227`).

## Architecture Insights

- One immutable policy shape with a per-family applicability matrix is safer than 16 unrelated limit schemas. Family verdicts stay separate while counting vocabulary remains shared.
- Production bounds and deterministic evaluation bounds are different failure locations. Producer exhaustion is truncated; evaluator exhaustion is broken.
- A result cap cannot require unbounded work to calculate the exact number omitted. Exact omitted counts are useful when available; a typed lower bound is safer than defeating the cap.
- Large bytes belong in bounded Artifacts. The inline payload remains narrow, while Artifact identity preserves expected length, digest, provenance, and truncation-at-production (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:335-341`).
- Limits are authority inputs, not local configuration knobs. Their identity, version, owner, and fingerprint belong in every evaluation key.
- At the measured commit, the accepted ADR set had a real non-Run authority gap. ADR 0019 closes it explicitly without expanding the coordinator or Convergence into an Evidence writer.

## Precedents & Lessons

Forty-three commits were analyzed as quantitative workload history. No similar implementation of Evidence-family numeric limits exists at this commit; the accepted ADRs intentionally deferred numeric defaults (`docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md:520`; `docs/adr/0016-language-observation-intake-and-evidence-authority.md:185-189`).

The strongest existing precedent is semantic: Context records distinguish `complete` and `truncated` (`packages/protocol/src/workspace-protocol.ts:217-227`), and the prototype validation reports unavailable/degraded gates instead of calling empty output clean (`.rpiv/artifacts/validation/2026-08-25_23-26-11_workspace-supervision-prototype.md:40-43`). Evidence must add exact counters, policy identity, and family verdicts rather than copying that lightweight projection.

## Historical Context (from `.rpiv/artifacts/`)

- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-63-evidence-ledger-architecture.md` — Evidence ledger architecture for issue 63.
- `.rpiv/artifacts/solutions/2026-08-26_ticket-74-language-observation-intake.md` — Language-observation intake and deferred numeric limits for issue 74.
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-61-parallel-worker-candidate-composition.md` — Parallel composition and conflict direction for issue 61.
- `.rpiv/artifacts/solutions/2026-08-26_03-57-45_ticket-62-finding-lifecycle.md` — Finding lifecycle and bounded remediation direction for issue 62.

## Developer Context

The developer asked to continue the already-scoped issue-78 investigation without another clarification round. The measurements remain historical low-confidence research. ADR 0019 subsequently accepts `0.1.0-local-balanced` as provisional local product authority and records the missing direct-owner and Integration-capture decisions.

## Related Research

- `.rpiv/artifacts/research/2026-08-20_19-27-59_runtime-constraints-program-order.md`
- `.rpiv/artifacts/research/2026-08-20_20-03-59_v1-program-requirements-coverage.md`

## Open Questions

1. Should issue 75's Convergence proof bundle use the same profile values or a separate bundle-level byte/member profile that references the family profile?
2. Which repositories and workload classes should form the first representative telemetry cohort before a non-local policy version is proposed?
