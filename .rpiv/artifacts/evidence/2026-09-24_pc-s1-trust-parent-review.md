---
date: 2026-09-24
author: OpenCode
commit: 97678d2
branch: feat/project-registration
repository: slopstop
topic: "PC-S1 bounded trust admission independent review"
tags: [evidence, review, pc-s1, trust]
status: in-progress
last_updated: 2026-09-24
last_updated_by: OpenCode
---

# PC-S1 — Trust Admission Review

## Scope And Identity

Mode: `candidate`. This is a bounded review within the same incomplete PC-S1, not whole-slice completion, human acceptance or an accepted predecessor.

All three independent roles received the identical [frozen packet](2026-09-24_pc-s1-trust-parent-review-packet.json), with actual worktree `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1` and base/original integration target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`.

- Original complete manifest: `Temp/opencode/pc-s1-trust-2026-09-24-snapshot.json`, SHA-256 `efd5d2f52dee798bb4b1d8f3e4e39209ed769cd6818dfbb9ab3d59a0e34c188d`.
- Exactly two replacement entries, with retained bytes in `pc-s1-trust-test-B8bmk6/source/`: `project-storage-historical-fixture.ts` = `7680e7d7e5088e8cf829048e84abff1f12adda80ab8ee89d831b2519a3987a47`; `registration-schema-fixture.ts` = `7811fd7002c7181c437bf4cb9420ca0b3b4bd9829b540a36f7f19b9376f6ca91`.
- Complete tracked binary patch remains `373a3179c9f1c66f6fa681215703cdc664d7475158ab4f3d206c48dc9d31cdee`. Both replacement files were already untracked, with their modes/status preserved. No manifest path was added or deleted.
- Effective contract content hash: `62f60b4067a9f9fcb60e33192d37d3b9ec3ee5dec47505584dd3078cecd3217e`, with all26 exact bindings retained.
- Final source capture `B8bmk6/inputs.json`: `b00877fd28d5e9efb8573b9b6436cf285723df0b80ca2035a21692ed461f3f5a`.
- Candidate evidence: `2026-09-13_pc-s1-implementation.md`, 134845 bytes, SHA-256 `d2fc0f97b6dda2aa2938d563a21d4e33c3daeb22acce2aa57f2e7a56c84a14de`; first128111 historical bytes preserved exactly.

Parent verified the50 included files,47 source files, modes, no staged changes, exact base,26 contract bindings and six final capture source maps before and after review with `Temp/opencode/verify-pc-s1-trust-parent-repair.mjs`. Both checks passed. Herdr showed all implementation sessions idle; parent made no candidate edits during this review. Bookkeeping is outside the bound candidate and contracts.

## Independent Outcomes

| Role | Session | Inspection | Outcome |
| --- | --- | --- | --- |
| Code reviewer | `ses_f2b90d9b3ffeM2qAf9Ui2C5IPu` | Completed; identity and contracts verified before/after | `failed`: three concern findings |
| Coverage reviewer | `ses_f2b90d8c1ffe8471GBa5LBxfD9` | Completed for bounded scope | Not ready: required mutation proof pending |
| Slice verifier | `ses_f2b90d877ffeI5P9qqYoIaGLoR` | Completed; identity and contracts verified before/after | `failed`: access-denied classification violates the contract; verification incomplete |

Reviewers were read-only and received no sibling conclusions. The parent independently traced the four code/test findings against current source before retaining them below. They are source-grounded findings, not newly executed reproductions. Report-row Jev lint was unavailable because `TYPESAFE_API_KEY` was absent; no credentials or installation were requested.

## Plan Review (Bounded Trust Admission)

One blocker, four concerns, zero suggestions. Resolution is deliberately empty pending human triage. Codebase locations below are relative to the candidate worktree.

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coverage + slice | Candidate Workflow / Available Quality Checks | `stryker.project-storage.config.json:3-8` | blocker | verification-coverage | **TR-5:** Applicable mutation proof remains pending for the changed database-spec scope. Existing passing integration tests do not supply it. | After approved repairs and source-bound Green, run the applicable scoped mutation command and retain its actual coverage/result; do not claim uncovered owners were mutation-tested. | |
| code | PC-S1 / D5 public outcomes | `apps/harness/src/registration/repository-trust.ts:86-96`; `registry-failure.ts:29-37` | concern | code-quality | **TR-1:** Syntactically valid but structurally invalid persisted directory identity, such as `{}`, throws a schema error that becomes `INTERNAL_FAILURE`, rather than `REGISTRY_CORRUPT`. | Classify invalid stored identity explicitly as registry corruption, retain unrelated unexpected errors distinctly, and prove the result through the public owner with zero admissions. | |
| code | Bounded Goal / native selection | `apps/harness/src/registration/repository-trust.ts:99-106,185-193` | concern | code-quality | **TR-2:** The native selection callback is awaited while a write transaction remains open. An arbitrarily long user choice holds the installation database write lock and can block unrelated registry operations. | Obtain the choice outside the write transaction; revalidate and persist in a short transaction. Prove another registry operation can proceed while the choice remains pending. | |
| code | PC-B9/PC-B10 / decision preservation | `apps/harness/tests/integration/registration-repository-trust-cases.ts:137-160`; `registration-identity-consent-cases.ts:115-136` | concern | test-contract | **TR-3:** Replay/conflict tests check results and later authority, but do not compare complete stored decision rows. An unintended timestamp rewrite could pass. | Compare complete rows before and after replay/conflict/restart, using an independent stored-data oracle. Treat already-correct production behavior as characterization, without invented Red. | |
| slice | V2 brief:88 / inaccessible repository | `apps/harness/src/registration/windows-file-identity.ts:106-110`; `repository-trust.ts:108-109,174-175` | concern | contract-correctness | **TR-4 (SV-TRUST-1, P2):** Windows access-denied error5 falls through to `broken / INTERNAL_FAILURE`; the required outcome is `unavailable / REPOSITORY_INACCESSIBLE`. Selection and revalidation propagate the incorrect result. | Distinguish access denied, including loss of access after consent, and prove the public outcome with zero admissions. Preserve genuine unexpected failures as broken. | |

The slice verifier's stable summary was: Decisions VIOLATION for SV-TRUST-1; Cross-slice INCOMPLETE for mutation and BROKEN historical qRsIkh/TQYB8a; Research OK. The coverage reviewer mapped all bounded goals to current source/tests, but that does not invalidate the stronger preservation-oracle gap identified by the code reviewer.

## Proof That Remains Valid And Its Limits

Current source-bound evidence still records216/216 registration/Storage integration tests,20/20 observer unit tests, harness typecheck, Biome and unchanged migration generation. Parent did not rerun tests during read-only review. The two fixture repairs retain exact independent old/current schema equality; all roles accepted that repair approach.

Original `qRsIkh` and `TQYB8a` remain historically **broken**, with `Worker exited unexpectedly` and no demonstrated cause. Later passing runs do not establish that cause fixed. `DIV4g4` has no complete historical tree-cleanup proof. Preserve this qualification in any new candidate.

Sonar remains **not assessed** under the recorded developer direction. No fast/deep, Electron, Linux, package or whole-PC-S1 acceptance is asserted. The six-query executor, registration/list/select/reopen and UI remain outstanding approved PC-S1 work, not newly completed behavior.

## Developer Checkpoint

Recommended triage: approve correction of TR-1, TR-2 and TR-4 with prospective public-seam Red/Green; strengthen the TR-3 preservation oracle; then run the applicable mutation proof for TR-5 and obtain fresh independent reviews of the changed identity. This is a recommendation, not a recorded human decision. Keep existing implementers frozen until the parent dispatches a bounded repair under the user's triage.

No source fix, candidate acceptance, commit, staging, push or integration occurred in this review step.
