---
date: 2026-08-26
researcher: OpenCode
repository: slopstop
branch: decision/ticket-74-language-evidence
commit: dd1fbf0
status: accepted
research_files:
  - .rpiv/artifacts/discover/2026-08-14_16-18-18_lsp-debugger-refinement.md
tags:
  - solutions
  - ticket-74
  - language-intelligence
  - evidence
  - lsp
open_questions: []
---

# Ticket 74: Language-Observation Intake Into Evidence

## Problem Statement

Language Intelligence must provide bounded semantic observations without letting a language server, adapter, Worker, or empty response become canonical code or Evidence authority. The intake contract must distinguish process readiness, operation completion, producer facts, Evidence evaluation, and downstream proposals.

## Constraints

- Git, content, revision, and syntax remain canonical code-location authority.
- A language server may enrich a Compound code anchor but cannot replace it.
- Execution alone starts processes and admits or cancels physical language work.
- Evidence alone decides whether one exact Language observation is current and usable.
- Missing, stale, truncated, cancelled, rejected, uncertain, ambiguous, failed, and broken outcomes remain distinct.
- A zero-member result can be favorable only when its exact operation is proved complete.
- Numeric result limits remain for ticket 78.

## Protocol Facts

The Language Server Protocol 3.17 does not make push diagnostics a general completion barrier. `didOpen` and `didChange` are notifications, and `publishDiagnostics.version` is optional. Pull diagnostics can carry a `resultId`; partial-result progress is complete only under the request's full protocol contract. Therefore a plain empty push notification cannot prove clean state.

## Options Considered

| Decision | Accepted direction | Rejected alternatives |
| --- | --- | --- |
| Draft provider decision | Treat the local ADR 0003 as revisable until published | Pretend an unmerged draft is binding; ignore its useful constraints |
| Observation unit | One immutable task-shaped operation | Whole-process snapshot; overlapping process and operation truths |
| Ownership | Language Intelligence owns the raw fact; Evidence owns evaluation and current authority | Evidence starts work; Language Intelligence judges itself |
| V1 scope | The exact source-to-resource pairs Worker Tool invocation/task, Composition operation/Composition, Candidate materialization review requirement/Candidate materialization, and Validation request/Candidate validation | Coordination without an accepted consumer; canonical Project workspace; Integration target; path-only scope |
| Family shape | One `language-observation` family with typed operation children | Family per operation; generic JSON payload |
| Completion | Versioned Capability proves pull diagnostics or another tested adapter barrier | Plain push diagnostics; best-effort clean |
| Dependency scope | Proven closure with whole-resource fallback | Direct documents only; unconditional whole-resource invalidation |
| Retry | New fenced request and attempt in one stable consumer check | Reusing request identity; accepting the first late result |
| Downstream authority | Diagnostics and mutations are proposals only | Direct Finding, Completion, or write authority |

## Accepted Direction

### Operation And Authority

- One stable `LanguageCheckId` identifies a consumer-owned requirement inside one exact Evidence scope and typed Run-workspace resource.
- Each dispatch receives a new immutable `LanguageOperationRequestId` and `LanguageOperationAttemptId` under that check.
- One `LanguageObservationId` is the Language-Intelligence-owned terminal fact for one operation attempt. Ordered chunks remain immutable history.
- Evidence records a separate typed Evidence observation referencing the raw Language fact or an exact Execution terminal outcome, then independently evaluates and decides it.
- The current Evidence key is the exact scope plus `LanguageCheckId`, not operation name, path, content hash, or request timestamp.

### V1 Surface

The closed read operations are:

- `diagnostics`;
- `inspect-symbol`;
- `find-references`.

Mutation output becomes a separate `LanguageMutationProposalId`. It is never a Language-observation verdict or write authorization.

### Reproducibility Seal

Every request and result binds:

- Project, Run, Evidence scope, Run workspace, exact physical resource, and accepted source fingerprint;
- stable check, request, attempt, process set, process generation, and ready waterline;
- accepted Capability version, completion strategy, adapter, server, language, TypeScript/toolchain, and configuration fingerprints;
- operation and schema versions, canonical request fingerprint, approved limits, cancellation generation, and producer attribution;
- ordered requested documents, versions, content identities, and a proven dependency closure;
- result chunks, final result digest, member and omitted counts, Artifacts, and observed/recorded times.

If an adapter cannot prove a narrower dependency closure, it seals the complete Run-workspace resource fingerprint. Process generation remains provenance for a completed result; a restart alone does not make that result stale when every semantic dependency is unchanged.

### Completeness And Empty Results

- An accepted Language Capability declares one tested completion strategy per operation.
- `diagnostics` requires LSP pull diagnostics or another adapter-specific barrier whose conformance proves source synchronization, terminal completion, partial-result assembly, and zero omitted members.
- Plain `publishDiagnostics`, even with a document version, is provisional enrichment unless the selected Capability proves an additional barrier.
- `inspect-symbol` and `find-references` require their terminal request response plus complete ordered partial-result assembly when partial results are enabled.
- An empty result is normal complete data with member count zero and omitted count zero. It proves only that exact operation and dependency closure, never global cleanliness.

### Freshness, Cancellation, And Retry

- A changed dependency-closure member or proof, configuration, toolchain, Capability, operation schema, request scope, policy epoch, approved limits, Artifact state, or trust basis invalidates only dependent current Language Evidence. Under a proved narrow closure, the whole-resource fingerprint remains provenance and unrelated source changes do not invalidate the result; under fallback it is the invalidating closure member.
- A process restart invalidates active readiness and in-flight attempts. It does not invalidate a completed observation solely because the process identity changed.
- Cancellation or supersession closes the current request generation. Later chunks or terminal responses remain attributed history but cannot become current.
- A retry compare-and-sets the `LanguageCheckId` to a new request generation and uses a new request and attempt identity. The old generation cannot advance the current Evidence row.
- Read-only retry may proceed after timeout or uncertainty because the admitted operation has no write authority, but only after Execution has fenced every older generation from current use.

### Evidence Verdicts

The family uses the closed verdicts:

- `LANGUAGE_OBSERVATION_COMPLETE`;
- `LANGUAGE_OBSERVATION_MISSING`;
- `LANGUAGE_OBSERVATION_STALE`;
- `LANGUAGE_OBSERVATION_TRUNCATED`;
- `LANGUAGE_OBSERVATION_CANCELLED`;
- `LANGUAGE_OBSERVATION_REJECTED`;
- `LANGUAGE_OBSERVATION_FAILED`;
- `LANGUAGE_OBSERVATION_UNCERTAIN`;
- `LANGUAGE_OBSERVATION_AMBIGUOUS`;
- `LANGUAGE_OBSERVATION_BROKEN`.

Only `LANGUAGE_OBSERVATION_COMPLETE` grants bounded result authority. It says nothing by itself about Test Red, Test Green, Completion, Finding disposition, Candidate acceptability, or Integration.

### Downstream Use

- Semantic URI, symbol, occurrence, and definition data are revision-bound hints attached to exact Compound code anchors and scope fingerprints.
- Diagnostics may create an attributed Finding proposal for independent technical evaluation. They cannot allocate a canonical Finding or decide its disposition.
- Language observations may be typed dependencies of later Test, Validation, Finding, Candidate-review, or Completion evaluations only through those families' own rules.
- Mutation callbacks remain durable even when rejected or broken. Valid proposals contain ordered edits and exact preimage or destination-absence proof. Execution must separately admit, revalidate, approve, declare, and apply any later mutation under the normal workspace, lease, Tool, Effect, and Candidate rules.

## Risks And Mitigations

- False clean from empty push diagnostics: require a Capability-proved completion barrier.
- Late-response resurrection: key current authority by check generation and fence every retry.
- LSP semantic authority creep: preserve Git/content/syntax anchor authority and treat semantic data as hints.
- Hidden mutation through callbacks: intercept edits as proposals with no write authority.
- Excessive invalidation: use proven dependency closure, with conservative whole-resource fallback.
- Self-judging producer: use a deterministic Evidence evaluator that validates the seal, chunks, freshness, limits, and schema without calling the same LSP.

## Approval

The user confirmed this direction after a dependency-ordered grilling session on GitHub issue 74.

## References

- `PRODUCT.md`
- `CONTEXT.md`
- `docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md`
- `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md`
- `docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md`
- Language Server Protocol 3.17 specification
- GitHub issue `#74`
