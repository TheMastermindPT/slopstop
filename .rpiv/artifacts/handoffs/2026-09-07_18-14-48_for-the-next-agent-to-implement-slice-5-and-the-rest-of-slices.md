---
date: 2026-09-07T18:14:48+0100
author: Pedro Mesquita
commit: 59fb35b
branch: feat/canonical-project-writer
repository: slopstop
topic: "Canonical Project Writer Remaining Feature Implementation"
tags: [implementation, canonical-project-writer, settlement, recovery, switching, tdd]
status: complete
last_updated: 2026-09-07T18:14:48+0100
last_updated_by: Pedro Mesquita
type: feature_development
---

# Handoff: Implement S5 And Remaining Writer Slices

## Task(s)

Continue `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` from **Slice 5: Atomic Typed Settlement**, then S6 recovery and S7 packaged proof, following the one-slice implementation/review/human-acceptance loop.

- **Accepted:** S1-S3 from the previous session, and now S4 Safe Project Switching. The user explicitly accepted the final S4 candidate after all three independent candidate reviews passed and the sole proof gap F1 was resolved.
- **Next:** S5 preflight and implementation. No S5 source, tests, fixture, or driver characterization has been authored or run. S6/S7 and final combined validation remain pending.
- The latest user request is to prepare this handoff for the next agent to implement S5 and the remaining slices. This turn is documentation only. Carry that goal into the normal resume/build checkpoint; S4 acceptance itself did not authorize S5 or integration. Do not execute several slices without their independent reviews and exact human acceptance.
- Direct execution of the design in the existing `C:/Users/pedro/Documents/GitHub/slopstop` working tree was explicitly selected. Do not reopen the old missing-plan-directory or new-worktree question. The shared candidate workflow permits this explicitly selected workspace.
- Branch remains `feat/canonical-project-writer`, HEAD `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`. **HEAD does not contain S1-S4.** All implementation is uncommitted; no staging, commit, push, CI dispatch, or merge occurred.
- Before writing this handoff: **44 tracked modified files, 25 untracked files, empty index**. All 291 accepted S4 manifest files still matched. This handoff adds one approved untracked metadata file; it is not part of that older frozen manifest. Never reset to HEAD or overwrite the worktree from a historical snapshot.

## Critical References

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`: canonical design, exact Test Contracts, approved execution revisions, and historical evidence. S5 starts at 11530, S6 at 11882, S7 at 12106.
- `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s4-review-20260907.md`: authoritative final S4 independent review, explicit human acceptance at line 64, and 7 automated/10 manual completion projection. **Read this even though it is outside the repository.**
- `AGENTS.md`: required PRODUCT/CONTEXT/ADR reads, architecture, strict TDD, safety, and CodeScene policy. ADR `docs/adr/0006-physical-persistence-layout.md` remains the persistence boundary owner.

## Recent changes

- `packages/protocol/src/canonical-project-protocol.ts:187,233`: strict source-qualified switch request/result schemas and destination correlation. New switch-owned retryability is exact; preexisting nested activation failure variants still allow either boolean where previously allowed.
- `packages/protocol/src/protocol.ts:47,207,232,450-461` and `packages/protocol/src/index.ts:1-27,86-87`: additive switch command/event/factories and public exports; protocol stays **4**, request.failure remains correlated, system.failure remains null-caused.
- `apps/harness/src/active-project-coordinator.ts:168-187,438-467,476-506,556-583`: synchronous FIFO admission counter, execution-time source/epoch checks, full release before inner activation, retained active versus null failed-acquisition epochs, explicit unfinished-stage retries, and ownership-safe release-clock failure. A-to-A creates a fresh epoch; failed B never restores A.
- `apps/harness/src/canonical-project-application.ts:18,50-62`: required switch method, strict result validation, complete original-request correlation, sanitized invalid-result error, and unchanged owner-thrown exception identity.
- `apps/harness/src/harness-runtime.ts:60-70,115-120`: actual switch dispatch. Cached stop, canonical-before-Storage shutdown, metadata creation and generic exception boundaries remain unchanged.
- `apps/harness/tests/integration/canonical-project-switch.integration.test.ts:34-861,879-1017,1049-1124`: direct lifecycle matrices, real-port journeys/exception containment, and the final F1 admitted-verification drainage addition.
- `apps/harness/tests/integration/project-storage-lifecycle.integration.test.ts:985-1050`: real Storage owner and MessagePorts prove ordinary A/B sessions remain independent from activation ownership.
- `apps/harness/tests/integration/project-storage-create-fixture.ts:575-581,777-853`: shared controlled public repository/lease/Storage ports and real channel composition. `verifyFence` is distinct from the release-stage `releaseFence`; holding the latter cannot prove admitted-work drainage.
- Required inert switch methods were added to existing canonical test literals without optional fallbacks. S4 changed exactly six production files, nine existing test/fixture files, and one new switch integration test; the design and separate evidence are additional documentation changes. S1-S3-only Storage/repository/migration/native-packaging source remained byte-identical to the accepted predecessor.

## Learnings

### Accepted Predecessor And Identity

- **Use this accepted S4 snapshot:** `C:/Users/pedro/AppData/Local/Temp/opencode/slopstop-s4-reproducible-candidate-20260907/`.
- `manifest.json` SHA-256: `49bb455e50145cc0bf06206dfef843e830849138bca1be3634a71c9ec27604ce`; 291 files, with full contents under `files/`.
- S4 contract identity: `bbe441879e651849d2c2af7444ffe02bc35d295dc09ca1325d542e3c245c3ef0`. Exact normalized section and referenced-guidance bindings, including the changed scheduling, are in `.rpiv/artifacts/evidence/2026-09-07_canonical-project-writer-s4.md:19-38,119-142`. S5 needs its own approved contract identity; do not reuse S4's pin as S5 approval.
- Complete `candidate.patch` SHA-256: `5b58740a8f5c698420e6e25119e29f3e8ba58a8a08cfc4f396695ca762865cae`.
- Accepted-S3-to-S4 `incremental.patch` SHA-256: `13c7936c1900b3bf6755084c672539c6ec20e03e45ef05be825c060378c8327c`.
- Supplemental `predecessor-complete.patch` SHA-256: `453ee8b9a698a07d60de9cff8c8ad97c3071196192d21585deb0bf10a9e0531b`. Accepted S3 manifest remains `20c024277de00955268ed9a5f58b7c4b18783ae76607d9d1d1e86e6e2d2aeed4`.
- The final patch was applied to an isolated HEAD archive and all reconstructed bytes verified; independent code and slice reviewers also reconstructed all three patch routes in memory. Both routes produce exactly 291 files with no missing, extra, or mismatched bytes. `reconstructed/` retains the parent proof.
- **S4 design checkboxes intentionally remain frozen/unchecked.** They are not the latest completion authority. All seven automated and ten manual criteria are satisfied in the external accepted review record. Acceptance was recorded there without altering the reviewed source/design/evidence bytes. Do not repeat S4 or treat the old markers as a missing implementation checkpoint.
- At this handoff, design raw SHA-256 is `7d42003d238dd994188137d47f0e5ba2123de482a3fc54c8de85349486a23508`; the external review including acceptance hashes to `bb960def81fc37be77548412abe2ec65949cd39f5cffbceff42b46cf741023ff`. Earlier review digests in evidence are historical before its append-only acceptance additions.

### TDD And Execution Ordering

- Read the current `rpiv-implement` skill and `C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/candidate-workflow.md`. A short approved design/slice is sufficient; preserve the exact accepted uncommitted predecessor and original main integration target separately.
- The roughly 13,000-line design contains cumulative future implementation fences. Derive only the active slice's delta from actual current source. Never overwrite working code with a whole final-projection fence.
- S4 originally had an impossible group dependency: B8/B15 required real application/runtime transport while assigned to coordinator-only G2. The user approved the narrowly scoped `2026-09-07T14:27:53+0100` correction after three independent intent reviews. Final groups were G1 B1-B3; G2 B4-B7/B9-B14/B16-B18; G3 application B19; G4 B8/B15/B20-B21 plus runtime B5/B19. All 21 original oracles stayed unchanged.
- Recheck S5's Expected Reds against accepted S4 before changing source. Shared implementation may satisfy later assertions early; do not fabricate serial Reds, deliberately regress existing behavior, count import/type/setup errors, or use timeouts as Red. Genuine regrouping/contract changes go through `rpiv-revise` and human approval.
- Detailed new evidence is append-only in the separate evidence file, linked from the design. Preserve earlier results, failed attempts, identities, approvals and reviewer findings; new fixes receive new candidate identities and reviews.
- Required `switchProject` stays required in all real ports and fixtures. Keep source/epoch/FIFO/barrier rules intact when S5 replaces verify-only admission with settlement. Runtime cached-stop policy is not an invitation to add another retry owner.
- Keep the approved S4 constant messages: `The active Writer fence could not be verified.`, `Typed-command settlement is not available in this release slice.`, and `Writer fence could not be activated.`. Lower-level owner diagnostics are distinct; never forward arbitrary owner exception text.

### Verification And Review

- Final accepted S4 proof: **312 unit + 201 integration tests**, all three consumer typechecks, scoped Biome, architecture and source-boundary checks, detailed CodeScene 10.0 for authored analyzable files, and a passing 58-eligible-file safeguard. Export-only protocol index is not numerically assessed.
- Parent independently reran 312 unit/197 integration tests before F1, then all four F1 cases afterward. The implementer ran the final complete 312/201 suites serially after F1. Exact commands, output digests and input hashes are in the evidence file; reruns are not extra distinct tests.
- The sole independent-review finding, F1, was a missing manual proof seam, not a production bug. Four real-MessagePort tests now hold two already-admitted verifications, deny a third command, prove no release/acquisition until both settle, and exercise current/current, stale/stale, rejected/rejected and current/rejected. They passed first time and are honestly recorded as already-Green verification, not fabricated Red. No production change was made for F1.
- All three final candidate reviews completed and passed: code `ses_f83638e6effevYq1oSKoafO4gP`, coverage `ses_f83638e36ffeTd3Bp6g6IVI3rt`, slice `ses_f83638e04ffeOyUVmG46L5DZv7`. Initial incomplete inspections were resumed rather than treated as clean. Final F1 resolution and zero remaining findings apply only to the accepted final identity.
- Run heavy checks serially. Concurrent integration/typecheck/CodeScene work caused three existing 15-second integration timeouts and a safeguard timeout. Identical isolated reruns passed without source, threshold or timeout changes; failures remain recorded as broken attempts.
- Root Vitest excludes integrations. Always use the explicit harness integration config for those files. Dedicated test-theater lint was unavailable; ordinary Biome passed. Do not claim an unavailable check passed or run global mutation/deep/native/package gates indiscriminately.
- Read `docs/agents/codescene.md` before CodeScene. Cloud OAuth worked with token/on-prem/account overrides unset; verification passed 5/5. Do not introduce credentials or change thresholds to obtain a pass.

### Tooling And Artifact Maintenance

- The previous missing context-mode execution blocker is resolved in this session: `ctx_execute` and other native `ctx_*` tools are available, and Windows subprocess execution works. `pnpm exec` uses pinned Node **24.19.0**, Vitest **4.1.10**. The host context process/global npx uses Node **24.20.0**; global npx inside the repo hit EBADDEVENGINES, including when launched through pnpm. Documentation lookup from the approved temp directory avoids the repo engine check. Inspect the next session's actual tools rather than reconstructing the old blocker.
- Never remove or reconfigure the user's context-mode OpenCode plugin. The earlier rejected configuration edit was not repeated. No global OpenCode configuration changed.
- Automatic artifact hooks still reported Node unavailable and skipped. Explicit project-managed Node validation works. At handoff, read-only `validate-artifact.mjs <design> --root <repo> --finalizing` passed.
- With explicit user approval, the stale design stamp was reconciled after freezing original bytes. One historical SQLite literal was wrapped in inline code because the validator misclassified it as a template token; its values/history were unchanged. Current design stamp is valid. Do not silently restamp later normative changes or mutate a frozen artifact during review.
- **Snapshot export pitfall:** the first generator accepted Git exit1 as a diff even when Windows `/dev/null` handling produced error stderr and empty output. Its old cumulative patches omitted untracked files, though complete files/manifests were captured. Those old completeness claims are explicitly corrected in evidence; never use the old patches for reconstruction.
- The corrected temporary generator uses real directory diffs, validates error output and untracked coverage, verifies HEAD archive blobs, normalizes patch headers, and checks actual reconstruction. Per-command `core.autocrlf=false` prevents Git apply from expanding LF to CRLF; no Git config file changes. Six historical design-whitespace warnings were preserved, not silently edited. Use only the final reproducible snapshot as accepted S4 authority.

## Artifacts

### Repository Artifacts Produced Or Updated

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`: document-only reconciliation, approved S4 scheduling follow-up, and link to separate execution evidence. S4 contract starts 11235; follow-ups at 12786/12802; inline Phase4 history starts 13138. S5-S7 contracts remain unchanged.
- `.rpiv/artifacts/evidence/2026-09-07_canonical-project-writer-s4.md`: full chronological G1-G4, scheduling intent review, F1, final commands/input hashes and export correction. G1 starts44, G2 144, G3 221, G4 284, parent rerun373, F1 380, export correction425. This is inside the accepted frozen snapshot; future evidence must preserve its history.
- `.rpiv/artifacts/handoffs/2026-09-07_18-14-48_for-the-next-agent-to-implement-slice-5-and-the-rest-of-slices.md`: this handoff, created after S4 acceptance.

### External Artifacts Produced

All paths below are under `C:/Users/pedro/AppData/Local/Temp/opencode/`; preserve them until an explicit resource decision.

- `slopstop-s4-review-20260907.md`: initial incomplete/non-clean review, user F1 triage, corrected clean reviews, exact S4 acceptance and completion projection.
- `slopstop-s4-final-review-packet.json`: identical final packet sent to all three reviewers, with contract, source, predecessor, patch and evidence bindings.
- `slopstop-s4-snapshot.mjs`: corrected parent-owned snapshot generator, not product source. Requires a new unused destination; optional predecessor directory supplies the incremental/supplemental patches. Its final successful run generated the accepted reproducible snapshot.
- `slopstop-s4-head-59fb35b/`: verified base-commit archive used for complete patch/reconstruction proof.
- `slopstop-s4-reproducible-candidate-20260907/`: **accepted S4**, including manifest, full contents, complete/incremental/predecessor patches, Git status and reconstruction.
- `slopstop-s4-predecessor-20260907/`: preserved accepted S3 contents/manifest and original pre-maintenance design; old cumulative patch is incomplete. Use the final snapshot's supplemental predecessor patch instead.
- `slopstop-s4-protocol-20260907/`: intermediate G1 snapshot; not S4 acceptance; old cumulative patch is incomplete.
- `slopstop-s4-candidate-20260907/`: original reviewed S4 candidate `0d093379...` before F1; non-clean and old cumulative patch incomplete.
- `slopstop-s4-f1-candidate-20260907/`: first F1 export `a04b9aa6...`, not accepted; old cumulative patch incomplete.
- `slopstop-s4-complete-candidate-20260907/`: intermediate directory-diff export `177e7b02...`, not the accepted final reconstruction.
- `slopstop-s4-verified-candidate-20260907/`: failed patch-header normalization attempt; no valid final manifest/acceptance.
- `slopstop-s4-final-candidate-20260907/`: failed CRLF-expanding reconstruction attempt; no valid final manifest/acceptance. The word final in this old path is not authority.

### Inherited Context, Not Modified Here

- `.rpiv/artifacts/handoffs/2026-09-07_11-52-38_for-the-next-agent-to-continue-the-implementation.md`: prior accepted S3 details, hashes and Linux provenance.
- `.rpiv/artifacts/handoffs/2026-09-04_19-30-09_after-slice-2-is-written-instruct-next-agent-to-do-design-and-continue-next-slices.md`: older history, not current progression authority.
- `/var/tmp/slopstop-s3-igyrrwdx/HANDOFF.md`, `s3-proof/REPORT.md`, and `s3-corrected-proof/REPORT.md`: retained WSL Ubuntu toolchain, historical and corrected S3 source/native proof. Readable via `\\wsl.localhost\Ubuntu\var\tmp\slopstop-s3-igyrrwdx\...`. No new Linux proof or modification occurred during S4. Never copy that old Linux source over current Windows work.

## Action Items & Next Steps

1. Read this handoff, the external S4 acceptance, separate evidence, required product/domain/ADR guidance and current implementation. Verify branch/index, accepted291-file manifest and contract. Account for this new handoff as authorized metadata outside the older snapshot; do not infer drift from its addition alone.
2. Load `rpiv-implement` and its shared workflow; select S5 as the next bounded slice. Preserve accepted S4 as an uncommitted predecessor plus underlying base SHA. Confirm continuation through the normal resume checkpoint without reopening S4 acceptance or the already-selected workspace.
3. Preflight S5's full contract at design11530-11880 against actual S4. Inventory includes ten modified production files and four new modules: `canonical-json.ts`, `canonical-command-registry.ts`, `storage/canonical-command-ledger.ts`, and `storage/canonical-command-settlement.ts`. Do not write any S6 recovery or S7 proof machinery early.
4. **First executable S5 gate:** author only the driver characterization in `apps/harness/tests/integration/canonical-command-driver.integration.test.ts`, importing no unimplemented S5 production symbol. Run `pnpm exec vitest run --config apps/harness/vitest.integration.config.ts apps/harness/tests/integration/canonical-command-driver.integration.test.ts -t "characterizes real worker savepoint rollback release and outer commit"`. Use the actual worker client and pinned `@libsql/client@0.17.4`/`libsql@0.5.29`, not node:sqlite instead. Prove rollback-to/release then outer commit `(3,2)`, release then outer rollback `(0,1)`, release then outer commit `(7,2)`, transaction.closed transitions, and missing-savepoint error. This is mandatory existing-Green characterization, not Red. Failure stops implementation for design revision.
5. Resolve real chronological/scope mismatches before affected implementation. In particular, design11767 says projected S3 configured only the initial connection, but accepted S3 already proved first/second actual transaction configuration. Retained transaction-close ownership and new settlement paths may still need genuine Red; separate them from already-Green connection setup instead of rewriting or manufacturing proof. Reconcile shared-behavior grouping and fixture migration scope through `rpiv-revise` when needed.
6. Implement S5 through the agreed seams with observed Red, minimal Green, separate review/refactor, appropriate CodeScene baselines and append-only evidence. Preserve exact literal independent fingerprint/receipt/event oracles, bounded single-flight/join/busy behavior, idempotency before registry work, SAVEPOINT rollback-of-handler writes, revoked-facade/issued-SQL drain, and retained transaction-close acknowledgement before releasing authority. Production registry remains explicitly empty; conformance counter is test-owned. S5 fails closed on unexpected settlement failure but does not claim S6 uncertainty classification.
7. Run the exact S5 scope at design11849-11880: focused protocol/JSON/registry, repository/Writer/coordinator/application, explicit integration and unchanged Storage-consumer suites, all four workspace typechecks, architecture, and manual observations. Do not repeatedly run global deep/package/mutation gates in each loop. Freeze the complete candidate, perform independent code/coverage/slice review, resolve findings with truthful proof, and obtain exact human acceptance before S6.
8. Preflight S6 only after accepted S5. Design11919 still requires the obsolete coordinator activation message; S4's accepted wording is now `Writer fence could not be activated.`. Design12051 also assumes predecessor activation timestamps are unvalidated, contrary to accepted S3 validation history. Recheck these against completed S5 and explicitly revise affected contracts; do not regress accepted validation to create Red. Preserve S6's uncertainty-before-release, retained cleanup and explicit durable reconciliation semantics.
9. After accepted S6, implement S7's genuine packaged Windows/Linux contention, forced termination/takeover, live stale-Writer refusal, exact durable audit and resource-cleanup proof. Source/native-loading proof from S3 is not packaged/crash proof. Preserve sandbox/fuses, actual process exit ownership, exact native version and output protocol; do not dispatch CI or change host configuration without appropriate authority.
10. Complete combined integrated-tree validation and required deep/package proof before any eventual integration. Request separate explicit commit/push/merge authorization; neither a slice acceptance nor this handoff authorizes those operations. Preserve all evidence and do not claim whole-feature completion until every required slice/gate is actually satisfied.

## Other Notes

- S3's F1 late-activation shutdown retention and F2 malformed persisted-authority validation remain unchanged and accepted; do not replace them with earlier projected repository/Storage code.
- Immutable original canonical migration SQL SHA-256: `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`; original snapshot SHA-256: `5e26d686143d3687a458752eaa08b22ed18454094fa24b5556b2bbd0c6d34523`; reviewed generation2 executable-vector pin: `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14`. Do not change a pin to bless arbitrary generated output. S5 uses unchanged generation2 schema, not a migration exercise.
- Native dependency remains exact `fs-native-extensions@1.5.1`. Accepted S3 Windows/Linux each proved141unit/29integration, fresh source build and isolated native loading, not S7 packaging. The existing EMPTY_IMPORT_META build warning remains documented/unsuppressed.
- No live application, active Project, credential, held native lease, or transaction should be reconstructed from this document. Current product/session startup remains inactive; proof snapshots are inert files, not runtime authority.
- This handoff is an additional metadata file after the accepted snapshot. S4's accepted source/evidence remain frozen and unchanged; its acceptance record is external specifically to preserve that identity. Keep the accepted snapshot available for S5's predecessor diff and final combined verification.
