---
date: 2026-09-07T11:52:38+0100
author: Pedro Mesquita
commit: 59fb35b
branch: feat/canonical-project-writer
repository: slopstop
topic: "Canonical Project Writer Feature Implementation"
tags: [implementation, canonical-project-writer, storage, fencing, switching, tdd]
status: complete
last_updated: 2026-09-07T11:52:38+0100
last_updated_by: Pedro Mesquita
type: feature_development
---

# Handoff: Continue Canonical Project Writer

## Task(s)

Implement `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md` using `rpiv-implement`. The user explicitly authorized executing this design directly after the missing-plan mismatch was raised. Do not reopen that directory/plan question. Its slices are the execution phases; their Test Contracts and verification criteria govern implementation.

- **Complete:** Slices 1, 2, and 3, including separate independent reviews. Slice 3's two review findings were fixed and the corrected tree was recertified on Windows and Linux.
- **Approved, not implemented:** Slice 4, Safe Project Switching. Its execution revision and baseline are recorded. No Slice 4 source/test/fixture edits or Red/Green cycles have started.
- **Pending:** Slices 5-7, final combined validation, and eventual merge.
- **Branch:** `feat/canonical-project-writer`, created from `main` at `59fb35be2b35a3e8d9f02ac4d274dc83f4fad468`. All implementation is still in the working tree. No commits, staging, pushes, CI dispatch, or merges were performed.
- The user requested a new branch to be merged at the end. Do not merge an incomplete or unverified feature; confirm commit/push/merge authorization when reaching that stage.

At handoff inspection, there were **44 tracked modified files and 22 untracked files**, with an empty index. This handoff adds one more untracked file. Preserve existing work, including the original untracked design and earlier handoff; never reset the tree to HEAD.

## Critical References

- `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`: executable design, approved revisions, checklists, and append-only evidence.
- `AGENTS.md`: architecture, strict red/green/review discipline, privacy, and standing decisions. Follow its required `PRODUCT.md`, `CONTEXT.md`, and applicable ADR reads.
- `docs/adr/0006-physical-persistence-layout.md`: canonical authority, durable settlement, generation fencing, and persistence invariants.

## Recent changes

- `packages/protocol/src/protocol.ts:43,160,494`: protocol version 4, non-null-caused `request.failure`, null-caused `system.failure`, and separate factories. Runtime and both Desktop bridges isolate request failures; the supervisor only escalates system failures.
- `apps/harness/src/storage/canonical-schema.ts:56,106,141,338` and `project-storage-database-specs.ts:912`: canonical generation 2, including Project state, Writer generations/fence, receipts, rejection/event authority, and exact schema verification. The schema is present; Typed-command settlement implementation is not.
- `apps/harness/src/storage/generated-migration-resources.ts`: narrow authorization for the reviewed generation-2 `storage_identity` rebuild, pinned to the exact executable statement vector. Unknown/unconsumed objects remain rejected.
- `apps/harness/src/active-project-coordinator.ts:389`: session-owned inactive/active/read-only/release-failed/stopped state, explicit activation epochs, retained Writer ownership, and admitted fence-check draining. No switch method or settlement machinery yet.
- `apps/harness/src/storage/project-storage-store.ts:573,590,631-633,712-746`: independent retained activation sessions, retryable cleanup, and shutdown ownership. Review fix F1 retains a late-opened session before attempting shutdown cleanup; later explicit stop retries unfinished cleanup without repeating acknowledged registry shutdown.
- `apps/harness/src/storage/canonical-command-repository.ts:138-148,314-332`: durable activation and fencing. Review fix F2 validates persisted authority before capability matching, distinguishing corrupt rows from well-formed stale authority.
- `apps/harness/src/storage/canonical-writer-lease.ts`: held native byte-range lease, precise contention/error distinctions, and retryable unlock/close stages.
- `apps/desktop/vite.harness.config.ts`: exact native dependency staging and corrected standalone `.vite/build` output alignment, while preserving sibling Forge outputs.

These are current line anchors, not an exhaustive source inventory. The design's per-slice inventories and Git status identify all changed/new files.

## Learnings

### Execution Discipline

- Load `rpiv-implement`; resume at **Slice 4**, not Slice 1. The user already approved all current Slice 4 revision details and implementation scope through both mismatch and `rpiv-revise` confirmation flows.
- The original design is a roughly 13,000-line merged final projection. Do not copy whole Architecture blocks into an earlier slice: they include S5 settlement, S6 recovery, and S7 proof-only code. Derive only the current slice's delta from live source.
- Original per-test Expected Red descriptions overlapped shared implementations. User-approved revisions explicitly group shared behavior and preserve original named tests/oracles. Follow those amendments; do not invent individual Reds for assertions that already pass.
- Every approved behavior/group must have a real observed Red before its implementation, then Green and separate review/refactor. Import/collection errors, missing native setup, and timeouts are not valid Red evidence.
- The root Vitest configuration excludes integration files. Run the explicit `--config apps/harness/vitest.integration.config.ts` command as well as the design's root focused command.
- Tests are not generated Architecture code. Keep exact inputs/output assertions, actual process/transaction seams, and failure privacy intact.

### Slice 4: Already Approved

The revision is at design **12786-12802**. Original Slice 4 starts at **11235**; Phase 4 evidence starts at **13126**.

Execute these four groups serially:

1. **Protocol B1-B3:** strict switch request/results, malformed inputs, factories, and exports.
2. **Coordinator B4-B18:** source-qualified switching, synchronous FIFO admission barrier, admitted-work drain, retained epochs/stages, clock failure, no restoration, and queued request revalidation.
3. **Application B19:** validation and exact original-request correlation. Preserve owner exception identities and sanitized invalid-result errors.
4. **Runtime B20-B21**, including assigned runtime portions of B5/B19: dispatch and exact real-port outcomes, request-failure isolation, and unaffected ordinary pending work.

All 21 original test names and Oracle blocks remain binding. Record baseline-Green regression assertions honestly within these groups.

Approved constant-message migrations, with corresponding existing assertion updates:

| Existing S3 message | Required S4 message |
| --- | --- |
| `Canonical Writer fence verification failed.` | `The active Writer fence could not be verified.` |
| `Canonical command settlement is not available.` | `Typed-command settlement is not available in this release slice.` |
| `Canonical Writer fence activation failed.` | `Writer fence could not be activated.` |

- These are constant diagnostic changes, not permission to forward arbitrary owner exception text.
- Retryability-flip assertions cover switch-owned diagnostics and the already-fixed read-only activation boolean. Preserve the existing nested activation variants that allow either boolean.
- The real synchronous-throw case throws immediately while another admitted check remains held. The separate two-held-promise matrix covers asynchronous resolution/rejection. Do not label an async wrapper's rejection a synchronous throw.
- Add required inert `switchProject` methods to listed fixtures, not optional dependencies or production fallbacks.
- Source scope is six files: canonical protocol, protocol envelopes, protocol barrel, coordinator, canonical application, and runtime. The design lists nine modified test/fixture files and one new switch integration test.
- Reuse inner activation under the lifecycle lock; calling public `activate` from switch would reenter the lock. Admission must close synchronously before the awaited FIFO callback starts.
- Retain actual activation IDs after failed active release; failed-acquisition cleanup retains a null epoch. Revalidate source Project and epoch at FIFO execution time.
- Preserve lower-level retry owners. A-to-A releases/reacquires with a fresh epoch; failed B never restores released A. A release-clock exception must preserve the original active executable state.
- S4 still uses `verifyFence` and `COMMAND_SETTLEMENT_UNAVAILABLE`. No `settle`, registry, fingerprints, busy slot, classified transactions, recovery journal, or S7 fixture belongs here.
- Runtime stop remains cached, and canonical shutdown precedes Storage shutdown. Do not introduce a new runtime retry policy.

### Verified Baseline

- **S1:** six Red/Green behaviors; 87 focused tests and three workspace typechecks passed; independent review found no actionable issues.
- **S2:** four approved behavior groups; 152 focused tests independently rerun successfully; generation checks, kernel/harness typechecks, exact schema metadata, and original migration immutability passed.
- **S3 corrected candidate:** 141 unit tests across 14 files and 29 integration tests across four files passed on both Windows and Linux. Both platforms passed fresh harness builds and isolated native-load proof. Independent re-review confirmed F1/F2 fixed without new actionable findings.
- S3 has **15/15 automated and 15/15 manual** criteria checked. Final acceptance is recorded at design **13108-13124**. Packaged crash/takeover proof and final deep validation have not run.
- CodeScene OAuth/config verification passed; do not configure a token or account override. Read `docs/agents/codescene.md` before further use. S3's 19 analyzable production and 19 test/helper files scored 10.0. Repository safeguard passed for 57 eligible files. S4's five analyzable production baselines are 10.0; its export-only barrel is not numerically assessed.
- Dedicated test-theater lint and plan-scoped mutation runners were unavailable. Do not misrepresent that as a clean executed gate or run global mutation indiscriminately.
- The existing `EMPTY_IMPORT_META` build warning is documented and unsuppressed.

### Immutable Resources And Native Proof

- Original canonical `0000_fat_doctor_octopus.sql` SHA-256: `e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c`.
- Original `meta/0000_snapshot.json` SHA-256: `5e26d686143d3687a458752eaa08b22ed18454094fa24b5556b2bbd0c6d34523`.
- Approved generation-2 executable statement-vector SHA-256: `e3a917fc5c7e2bc5a5a20ae9c50160cd072d6b49a35856530cc0118fbbca5b14`. Do not update the pin to bless arbitrary generated output.
- Installed native package is exactly `fs-native-extensions@1.5.1`. Windows binding SHA-256: `dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4`.
- User authorized one isolated WSL Linux root: `/var/tmp/slopstop-s3-igyrrwdx`. It retains verified Linux Node 24.19.0/pnpm 11.5.1, source snapshots, dependencies, manifests, and proof reports. No global/distro/profile changes or sandbox weakening were authorized.
- Corrected Linux proof verified 288 copied inputs unchanged. Windows/Linux bundle hashes differ; source equivalence, not byte-identical cross-platform bundles, was proved. Read the corrected report for exact commands and all hashes.
- Local Windows/Linux source proof was explicitly approved as an alternative to actual CI execution. Existing CI discovery was checked statically; no CI job was dispatched or claimed to have run.

## Artifacts

- **Updated execution artifact:** `.rpiv/artifacts/designs/2026-09-04_18-05-05_canonical-project-writer.md`. Slice starts: S1 10887; S2 10943; S3 11005; S4 11235; S5 11530; S6 11882; S7 12106. Evidence starts: Phase 1 12804; Phase 2 12898; Phase 3 12966; Phase 4 13126.
- **This handoff:** `.rpiv/artifacts/handoffs/2026-09-07_11-52-38_for-the-next-agent-to-continue-the-implementation.md`.
- **Preserved original handoff, not authored or modified here:** `.rpiv/artifacts/handoffs/2026-09-04_19-30-09_after-slice-2-is-written-instruct-next-agent-to-do-design-and-continue-next-slices.md`.
- **Linux toolchain handoff:** `/var/tmp/slopstop-s3-igyrrwdx/HANDOFF.md`.
- **Historical first Linux proof:** `/var/tmp/slopstop-s3-igyrrwdx/s3-proof/REPORT.md`. Superseded for acceptance by the corrected candidate below; do not delete its history.
- **Accepted corrected Linux proof:** `/var/tmp/slopstop-s3-igyrrwdx/s3-corrected-proof/REPORT.md`. Its linked manifests/provenance/output files are the detailed external evidence inventory.
- **Test-only frozen migration artifact:** `apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql`; production successor SQL/journal/snapshot were generated by Drizzle and verified against this independently frozen input.
- Saved Git blobs for revision preservation, not commits: pre-S3 design `b2ac8f41db74abc7e8a7cf3bd4a832d696c34c1a`; pre-S4 design `a076068ab6cae674d5ee14463502c9b0bdfaa7cb`.

## Action Items & Next Steps

1. Inspect current branch/status and read the approved S4 Follow-up and Phase 4 evidence. Preserve all working-tree changes; HEAD does not contain the implementation.
2. Check the new session's actual execution tools and active policy before editing. Resolve the environment issue below without re-asking for S4 behavioral approval or automatically modifying the user's OpenCode configuration.
3. Resume the **S4 protocol group B1-B3** with a real failing test. Complete the four approved groups, exact focused unit/integration commands, protocol/harness/Desktop typechecks, architecture validation, and Code Health reviews. Do not substitute type/import failures for behavioral Red.
4. Append evidence and check only actually satisfied S4 criteria. Obtain a separate independent review, fix findings with regression Red/Green, and verify the final candidate before advancing.
5. Preflight S5 against the completed S4 source. Its real worker/libSQL SAVEPOINT characterization must pass honestly before settlement implementation. S6 owns uncertainty recovery; S7 owns packaged Windows/Linux crash, takeover, stale Writer, and cleanup proof. Surface genuine new contract mismatches through `rpiv-revise`; do not silently weaken gates.
6. Complete combined validation and required packaged/deep proof before any eventual merge. No full-feature completion has been claimed.

## Other Notes

### Execution Blocker And User Preference

The session exposed neither `context-mode_ctx_execute` nor `context-mode_ctx_batch_execute`, while injected context-mode policy prohibited running Vitest through Bash. The S4 agent therefore stopped before writing tests/source. Restarting OpenCode did not expose those tools to the parent or subagent.

The user explicitly asked to continue **without context-mode tools** and rejected an attempted removal of the plugin from global configuration. **Do not repeat that configuration edit.** `C:\Users\pedro\.config\opencode\opencode.json:23` still contains `"context-mode"`; the configuration was not changed. If the next session permits ordinary execution tools, use them and continue. If it still carries the same prohibitive policy, report the precise constraint rather than bypassing it or claiming unrun tests.

Current official context-mode documentation says the OpenCode plugin itself registers native `ctx_*` tools; it warns against adding a redundant legacy `mcp.context-mode` entry. No such MCP entry was added. A cached-plugin diagnosis was cancelled; no installed-version/root-cause conclusion was reached. Do not infer that another MCP entry is the fix.

### Artifact Validation

The execution artifact's original `content_hash` is stale after user-approved revisions, checkboxes, and appended evidence. A read-only finalizing validator run after S2 reported only that mismatch; later S3/S4 content has not been fully revalidated. The hash covers the entire body, including evidence; there is no supported exclusion for execution sections.

Write hooks repeatedly reported `Node executable unavailable` and skipped validation/fence-duplication checks. Those skips are not passes. A working terminal Node can run `C:/Users/pedro/rpiv-claude/rpiv/skills/_shared/validate-artifact.mjs` with the artifact path, `--root C:/Users/pedro/Documents/GitHub/slopstop`, and `--finalizing`. Do not stamp during concurrent edits. Deliberate final re-stamping is maintenance of the revised body, not proof that the original body stayed unchanged; preserve revision/evidence history and verify afterward.

No credential, native lease, live application process, or implicit active Project should be reconstructed from this handoff. Retain proof resources until their owned cleanup is safe; never copy the old Linux source snapshot back over newer Windows work.
