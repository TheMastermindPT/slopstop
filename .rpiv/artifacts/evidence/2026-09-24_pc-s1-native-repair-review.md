---
date: 2026-09-24T12:05:14+0100
author: Pedro Mesquita
commit: 97678d2
branch: feat/project-registration
repository: slopstop
topic: "PC-S1 narrow native trigger repair candidate review"
tags: [evidence, candidate-review, pc-s1, native-observer]
status: complete
last_updated: 2026-09-24T12:05:14+0100
last_updated_by: Pedro Mesquita
content_hash: 399c2c7c40d5ae037c489f3e75a6dede005084cbafed98f199f998f74072dfdd
---

# PC-S1 Native Trigger Repair — Independent Candidate Review

## Outcome And Scope

**Scoped gate: failed.** All three inspections completed; two concrete timing defects remain in the native repair. The source snapshot stayed unchanged throughout review. No whole-PC-S1 readiness, candidate acceptance, new predecessor, commit or integration is implied.

Review covers native overflow classification, first-trigger preservation and the affected child/cleanup deadlines through their public observer outcomes. The broader registry/lifecycle, owner-loss/PID-reuse, UI, registration and package work stays pending rather than being counted as a defect merely because it is outside this repair.

## Exact Inputs

- Packet: `2026-09-24_pc-s1-native-repair-review-packet.json`, SHA-256 `bb2ba1ef82b9688ee0986a74f594eaf57a0552c61907cc3b332a0010686ef4e4`.
- Snapshot manifest: `2026-09-24_pc-s1-native-repair-snapshot.json`, SHA-256 `69e25b8e0fb354290c65382f21fb633082707fde440a96683732b7fcca0fa345`.
- Binary-capable tracked patch: `Temp/pc-s1-native-repair-review.patch`, SHA-256 `0c49fca56846980249eee6336c37737f4c4662da0c488bf3592112ee767b770c`.
- Candidate/root: `C:/Users/pedro/Documents/GitHub/ragnarok-pc-s1`; base and original integration target `97678d2a131daaf0791822ed3f5a7c3977ee7e7c`.
- 39 included file hashes/modes, 36 preserved non-Markdown source bytes and 26 approved intent bindings verified. Incoming VilEQT remains an unaccepted WIP comparator. Repair changes are exactly five modified incoming sources plus three additions.
- Parent verified the full current inventory, saved patch, preserved raw bytes and all four equal-source final captures before dispatch and after reviews. Evidence Markdown is explicitly excluded from source reconstruction but separately hash-bound while frozen.

## Independent Inspections

| Role | Session | Result |
| --- | --- | --- |
| Slice verifier | `ses_f2cdcef71ffesEOEAihs1Ky1rU` | Complete; scoped gate failed on cancellation origin/precedence after resume |
| Code reviewer | `ses_f2cdced55ffeoMcc687gRvxiNc` | Complete; scoped gate failed on post-resume cancellation and post-close cutoff |
| Coverage reviewer | `ses_f2cdcecbdffecJhCz66fV5eBBx` | Complete; no actionable gaps returned for the mapped cases; acknowledged outside-scope general readiness gaps |

No reviewer executed tests, native processes or builds or edited the candidate. They read actual sources, preserved before/after test inputs and captured outcomes. Coverage's clean mapping of the existing scenarios does not negate the two concrete counterexamples found by the other roles.

## Findings And Coordinator Triage

| ID | Sources | Location in frozen candidate | Finding | Disposition |
| --- | --- | --- | --- | --- |
| NR-1 | Slice F1 (blocker/P2); Code C1 (concern) | `apps/harness/src/registration/windows-version-child.ts:62-87,298-323,534-553` | `beforeDeadline` removes the abort listener after the ownership callback. Once resumed, polling checks deadline before cancellation and stamps cancellation with polling time. Cancel at1999ms followed by polling at2000ms becomes limit rather than the original cancellation, and a delayed poll can restart its cleanup budget later. Existing delayed-cancel test holds `onOwned`, so it covers only the earlier phase. | Required correction of the already-approved D2 first-trigger rule; add prospective public tests after resume, including a poll crossing the child deadline and one still before it. Keep first event/time throughout observation. |
| NR-2 | Code C2 (concern) | `apps/harness/src/registration/windows-version-child.ts:45-59,558-560` | A successful `resources.close()` returns without checking the original cleanup deadline. Terminal proof at4999ms followed by close completing at5000ms can be accepted despite the timeout-at-equality rule. | Required correction of the existing cleanup cutoff; add prospective public before/at/after close-completion cases, preserving original cause and durable uncertainty on late completion. |

Parent independently read the cited code after the reviews: the abort listener is removed in the narrow helper's finally, post-resume polling uses current time, and successful resource closure returns immediately. These findings do not require new product scope, dependency, permission, numerical policy or a weakened gate. Coordinator continuation will implement the existing requirements; it is not represented as a new direct human policy decision.

## Evidence That Remains Valid Within Its Scope

- Actual8193-byte stdout/stderr pipe cases exercise native overflow and corrected typed outcomes.
- Existing fault/clock cases prove their declared force/process/EOF/call-crossing scenarios and the ownership-callback cancellation case. They do not prove the missing post-resume or successful-late-close variants.
- Captured final typecheck exit0, unit20/20, registration integration71/71, and Biome30-file pass correspond to the frozen bytes. The old150-test Storage-inclusive run was not relabelled as current coverage.
- Parent CodeScene safeguard independently passed30 eligible/checked files with one improvement in an unchanged-for-this-repair schema-spec file. `issues-found` is not described as no findings. Setup check was5/6: Git/OAuth/CLI/API/runtime passed; the automatic agent-guidance recognizer failed while repository-linked CodeScene instructions were read. Reference: https://codescene.io/docs/integrations/mcp.html#configuration .
- Sonar remains not assessed; no setup/retry. Automatic evidence frontmatter warning is retained, not treated as source approval. Optional RPIV `jev-lint` reported unavailable because no TypeSafe key was present; no key was provisioned or Jev inference result claimed.

## Next Bounded Work

Preserve this failed snapshot and review. Resume only NR-1/NR-2 under the existing PC-S1 authority with prospective Red/Green, separate review/refactor, focused checks and fresh CodeScene. Freeze the corrected input and rerun affected independent reviews against the new identity. Do not advance to unrelated registration/UI work or mark the larger observer packet complete at this checkpoint.
