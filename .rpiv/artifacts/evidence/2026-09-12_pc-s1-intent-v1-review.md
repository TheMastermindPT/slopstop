# PC-S1 Independent Intent Review — v1

## Identity And Outcome

- Mode: `intent`; slice: `PC-S1`; outcome: **failed**. This is a completed inspection with mandatory design gaps, not an unavailable tool or a tested implementation failure.
- Shared packet: `2026-09-12_pc-s1-intent-v1.json`, raw SHA-256 `34298109e9b7ce23c6afa02145a5f619ab634fce019e07d0d7ad7d1159569acb`.
- Brief: `.rpiv/artifacts/designs/2026-09-12_22-45-37_persistent-project-conversation.md`.
- Brief raw SHA-256: `24d799c3d4d126f4ff7ecb60b16f6b72a862532ece8e568dbff6e33b65dd116f`.
- Brief stamped content hash: `85e613dcb9850da6153ca90f2fb703db7e7a3bb7144a7a93895d4fc69ed34abf`.
- Source base: `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`; reviewers verified source unchanged from that base and only the identified documentation changes present.
- All three reviewers verified 20/20 authority bindings before and after inspection. The coordinator repeated the comparison after all responses: 20 bindings, zero mismatches.
- Reviewers ran no tests/builds and made no changes. Prior writer qualifications were retained rather than converted into PC-S1 evidence.

| Role | Session | Inspection | Gate |
| --- | --- | --- | --- |
| `rpiv:slice-verifier` | `ses_f6844e50affeGSedEnyvQH0rDQ` | complete | failed: three mandatory contract gaps |
| `rpiv:artifact-code-reviewer` | `ses_f6844e3a8ffebWOGYAZqYDRaGa` | complete | failed: three blockers, three concerns |
| `rpiv:artifact-coverage-reviewer` | `ses_f6844e336ffe4pU44AJuW4fa05` | complete | failed: six verification-contract blockers |

## Slice-Verifier Findings

| ID | Severity | Finding | Grounding | Required correction | Resolution |
| --- | --- | --- | --- | --- | --- |
| SV-1 | blocker | Configuration includes permit reading outside the repository while no-credential-access remains absolute; no disclosure is not proof of no read. | Brief:50,139,195; PRODUCT.md:152; bootstrap:84-118 | Obtain exact read-authority decision or verifiably prevent forbidden reads; distinguish reading from disclosure in tests. | |
| SV-2 | blocker | Observation deadlines do not define bounded child termination, stream drain or result publication when exit occurs without EOF. | Brief:140-141,195; harness-runtime.ts:201-230; active-project-coordinator.ts:451-467 | Specify finite cleanup/escalation and owner-loss outcome with exact temporal oracles. | |
| SV-3 | blocker | Associating a second worktree requires a canonical command and active writer, but the public contract only counts identities/locations. | Brief:54,70,157-161; process-bootstrap.ts:93-105; canonical-command-registry.ts:113-119; active-project-coordinator.ts:582-605 | Fix admission, minimum command, no-writer result and lost-settlement reconciliation, without implicit Project switching. | |

Stable reviewer summary: Decisions — violations SV-1/SV-2; Cross-slice — violation SV-3; Research — OK. The reviewer explicitly verified the initial-create exemption in the accepted Storage design:114-118 and rejected requiring a fictional new Effect family for initial creation.

## Plan Review — Independent Code And Coverage Pair

Both roles inspected the identical bound intent. Locations below refer to that version, not a future corrected draft. Recommendations are proposed dispositions; blank resolution cells mean developer triage has not occurred.

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | Project-entry transaction boundary; PC-B2 | apps/harness/src/active-project-coordinator.ts:582 | blocker | actionability | A/B/C confirmation does not establish target writer activation; no production association command exists. | Define the narrow association command, activation requirement, pending/no-writer outcome and canonical settlement oracle. | |
| code | Registry compatibility; observer policy | n/a | blocker | actionability | Verified physical identity lacks a persisted representation, supported-platform contract and restart continuity rule. | Define a versioned identity adapter/key and exact aliases/replacement/unprovable outcomes. | |
| code | Observer configuration-read boundary | n/a | blocker | code-quality | Local includes may read external credential-bearing files even when values never leave the process. | Resolve permitted read scope or enforce verifiable restriction before approval. | |
| coverage | PC-B6 | n/a | blocker | verification-coverage | No prior unrelated witness fixture proves a registration reservation cannot bypass witness checks. | Add exact diagnostic and unchanged-byte oracle with an unrelated pre-existing witness. | |
| coverage | PC-B7 | n/a | blocker | verification-coverage | Switch/drain and stale-write obligations lack a concrete delayed-operation race. | Name tests and hold an admitted operation while switching/closing; prove old activation makes no write. | |
| coverage | PC-B8 | n/a | blocker | verification-coverage | Current head without DDL and missing registry bytes with witnesses are not explicitly tested. | Add both persistent fixtures with no mutation/new-registry assertions and distinct outcomes. | |
| coverage | Observer first-use trust | n/a | blocker | verification-coverage | Executable/version confirmation and replacement invalidation lack a public-flow oracle. | Test first-use confirmation, executable replacement and refusal until renewed selection. | |
| coverage | Observer physical identity | n/a | blocker | verification-coverage | Platform identity proof lacks positive alias/case tests and unsupported-platform behavior. | Add platform conformance cases and refusal when identity cannot be proved. | |
| coverage | PC-B9 | n/a | blocker | verification-coverage | Unconfirmed termination does not explicitly require rejecting another attempt or controlled reopening. | Test no second spawn, no late publication and reopening only after proven terminal reconciliation. | |
| code | Observer child ownership; PC-B9 | apps/harness/src/harness-runtime.ts:225 | concern | actionability | Cleanup limits, shutdown integration and continuity after owner death are unspecified. | Define bounded local child lifecycle and restart admission; do not assume process exit proves cleanup. | |
| code | PC-B5 and PC-B8 | packages/protocol/src/project-storage-protocol.ts:73 | concern | test-contract | Distinct failures are described without exact public code/status pairs or simultaneous-fault precedence. | Add input-to-public-result matrices with stable precedence. | |
| code | PC-B6 | apps/harness/src/storage/project-storage-store.ts:432 | concern | test-contract | Completed-or-recovery alternative conflates physical publication with activation commit. | Separate crash points and pin exact result for each known persistent state. | |

## Coordinator Grounding And Proposed Triage

The findings are supported by omissions or explicit open qualifications in the bound brief. Three themes overlap across reviewers: config read authority, child cleanup, and canonical second-worktree association. Coverage rows add specific missing oracles rather than reporting absent execution of future tests as a defect.

Recommend addressing every technical contract and coverage gap, then re-pinning and rerunning all affected intent roles. Do not mark failed v1 as passed after editing. The original packet, hashes and findings remain evidence of what this inspection evaluated.

One decision changes the interpreted user authority and must be resolved explicitly: whether read-only inspection may let Git follow its normal local configuration includes outside the selected repository. Prohibiting credential-helper use/network/disclosure is distinct from guaranteeing that a referenced local configuration file contains no credential value. The existing approved use of Git does not erase that distinction. The coordinator recommends an explicit, visible effective-configuration read grant, no model/telemetry/log/persistence of config contents, and no credential resolution or effectful Git operation; this remains a proposal until the developer decides.

No source implementation, candidate approval, commit, push or issue closure follows from this report. The frozen brief and referenced coordination record were not changed while reviewers inspected them.
