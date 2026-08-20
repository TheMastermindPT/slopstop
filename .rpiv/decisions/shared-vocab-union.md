---
key: shared-vocab-union
status: accepted
scope: standing
rule: "When the same constant/regex/vocabulary is hand-copied across sibling helpers, extract ONE owning module whose value is the union of every copy, prove identity first, then migrate consumers in small commits."
decided: 2026-07-23
updated: 2026-07-23
author: Pedro Mesquita
source: .rpiv/artifacts/plans/2026-07-23_00-15-31_shared-and-ar-helpers-hardening.md
---

# Decision: Extract shared vocabulary as a UNION, never "pick one"

## Context

The 2026-07-21 architecture review of `skills/_shared` + `skills/architectural-review/_helpers` found the "reviewable source file" vocabulary hand-copied at three sites with one copy already silently drifted (`mutation.mjs`'s 6-extension set vs `metrics.mjs`'s 18, under a false "same set" comment), plus duplicated thresholds and a duplicated stdout grammar. The repo had already centralized once for the same failure class (`citation-grammar.mjs`'s CITE_RE, commit `babd0ce`, after two drifts).

## Decision

When the same constant, regex, or vocabulary is hand-copied across sibling helpers and the copies have (or could) drift, extract ONE owning module whose value is the **union** of every copy — so no consumer silently loses a token when it migrates. Prove identity first (diff the copies), land the shared module with one consumer already on it, then migrate the rest in small commits. Document any surviving corner case in the module header as an accepted risk.

## Consequences

Genuinely additive per-consumer supersets (e.g. a type-resolved algorithm layered over a regex seed) are architecture, not duplication — keep them. Duplicated extension sets, thresholds, preambles, and stdout grammars with no shared owner must be extracted, not mirrored. New helpers must import the owning module rather than re-declaring the vocabulary.

## History
- 2026-07-23 accepted — promoted from the shared+AR-helpers hardening plan (methodology principle M1 of the 2026-07-21 architecture review). source: .rpiv/artifacts/plans/2026-07-23_00-15-31_shared-and-ar-helpers-hardening.md
