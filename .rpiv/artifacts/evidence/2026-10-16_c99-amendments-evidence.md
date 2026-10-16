# #99 amendment set (slice c99-s1) — verification evidence

Slice `c99-s1-adr-amendments`, rigorous lane, documentation only (TDD-exempt per the brief: AGENTS.md "Test Discipline", documentation-only decision work). Implementer: Claude Opus 5.5, 2026-10-16.

## Identity

- Brief: `.rpiv/artifacts/designs/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness.md`, revision 3, `content_hash 0170dcb8d10d8de977afa1272b69cafd4fe22adf764517a984d86e788a44a0c2`. Approved copy (main checkout): `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/approved-0170dcb8….md` (decisions log §96).
- Workspace: linked worktree `C:/Users/pedro/Documents/GitHub/slopstop-99`, branch `docs/99-cross-waypoint-dialogue`, base `1b2256a`.
- Start checks (cwd = worktree):
  - `node …/validate-artifact.mjs <brief> --root <worktree>` → `validate-artifact: OK` (exit 0).
  - `node …/append-only.mjs <approved copy> <brief>` → `append-only: keep` (exit 0).
  - Decisions log §96 present (approval, workspace, recorded `--finalizing` fence deviation).
- Lane: brief `lane: rigorous`. `node …/lane.mjs --paths <13 changed files>` → `lane: normal` (`files: 13 > 5`; diagnostics `slices unknown`, `lines unknown`, `hub signal unavailable`). Raise-only keeps **rigorous**. The `--range` re-check on the commit is recorded under "Post-commit".
- Candidate status: every new Amendment section and dated note is written **Proposed** (Q12). Pedro's acceptance of this candidate flips them to Accepted in the single commit and is recorded in the decisions log.

## Files changed

Amendment sections (appended, `Status: Proposed (2026-10-16)`): ADR 0011 Amendment 1 (joint amendment, task hold), ADR 0013 Amendment 1 (`project-coordination` subject), ADR 0017 Amendment 1 (decision revisions as mandatory Memory dependencies), ADR 0021 Amendment 1 (phase 2 dialogue, Run-absent invocations, coordination budgets), ADR 0022 Amendment 1 (retirement, wording-only, echoes, search, decision-change item).

Dated notes (inserted before `## Context`, `Note (2026-10-16): … (Proposed)`): ADR 0006, 0007, 0008, 0009, 0010, 0015.

Status-line suffix on all eleven ADRs. `PRODUCT.md` and `CONTEXT.md` edited in place on the listed lines only, plus new `CONTEXT.md` terms. ADR 0020 is classified unaffected inside the ADR 0010 note and is not edited. No code, schema, protocol or `docs/architecture` file is touched.

All line references inside the amendments cite the ADR text accepted before the change (commit `1b2256a`), as each amendment states.

## Gates (cwd = worktree, on the uncommitted candidate)

| Gate | Command | Result |
| --- | --- | --- |
| Fast gate | `pnpm check` | passed (exit 0): format, lint, typecheck, `vitest run` 83 files / 3024 tests passed, depcruise no violations. Wall time 3m55s (the run includes the full unit suite; the coordinator's brief lists it as required). |
| Duplicates | `pnpm check:duplicates` | passed (exit 0): golden SQL check, jscpd "Found 0 clones". |
| Dead code | `pnpm knip` | passed (exit 0), no findings. |
| Architecture | `likec4 validate docs/architecture` | not run: `docs/architecture` not touched. |
| CodeScene | `pre_commit_code_health_safeguard` | not applicable: no code file touched. |

## D99 verification rows

Content checks ran with `bash checks.sh <worktree>` (script reproduced at the end): **152 PASS, 0 FAIL**, exit 0. Count of fixed-string checks per row in brackets.

| Row | Command | Result |
| --- | --- | --- |
| V1 | `rg -n "only the user approves\|typed proposal that the user decides\|budgeted from the Run\|(Forger\|Waypoint[- ]parent) (or\|and) (a )?Worker\|coordination budget\|fourth variant\|fourth or generic\|read-only Worker\|run-workspace.*task-workspace.*candidate\|run-worker.*project-operation.*integration" docs/adr PRODUCT.md CONTEXT.md` | passed: every hit classified (below, "V1 classification"). |
| V2 | checks.sh [11] | passed: ADR 0021:44, :34, :91 and `PRODUCT.md` "Manual Actions create a Run only through Begin" unchanged; admission (`map-link`, `supervisor-admission`), per-message routing event, hold sources (admitted typed Forger proposal or user action; "Message text never places a hold"), "The Supervisor starts nothing". |
| V3 | checks.sh [4] | passed: ADR 0011:84, every :91 input by name, :174, decision contradiction. |
| V4 | checks.sh [8] | passed: payer table (hand-over/Contest/re-check, Strand without budget, pre-budget Strand search, follow-up turn, Foundation inference); "never debit a Run"; "never zero"; one `project-coordination` subject per Run-absent dispatch. |
| V5 | checks.sh [9] | passed: four codes and four end reasons stated; detector `not-run`/`failed` distinct from "no conflict"; broken checks never read as clean. |
| V6 | `rg -n "closes (new )?(Run )?dispatch\|dispatch stays closed\|dispatch closes until\|amendment-requested\|\bStartRun\b\|reopens dispatch\|close their applicable dispatch" docs/adr PRODUCT.md CONTEXT.md` | passed: every hit joint-excepted, kept for single-Run, or unrelated (below). One fix during the run: ADR 0011:216 and :212-217 were added to the amendment's named sentences. |
| V7 | checks.sh [4] | passed: ADR 0011:35, :54, :140, :152, :166, :168, :223, :250, :288; ADR 0015:48, :133, :148, :150-151; `PRODUCT.md:105`; `CONTEXT.md:60` carry the joint-only `unaffected-continuing` exception; `continuing-result` defined in the ADR 0015 note. |
| V8 | checks.sh [10] + `rg -n -i "joint[^\|]*\bstale\b"` over added lines | passed: joint state is `changed`, never `stale`; target shapes, causes and statuses unchanged; `task-hold` in ADR 0007:79 note and `CONTEXT.md:58` together; source states and `JOINT_COMPONENT_STATE_INVALID`; only `SubmitJointRunAmendment` seals; three Portuguese copies mapped to distinct states. |
| V9 | checks.sh [3] | passed: ADR 0011:37, :38, :60, :224, :248 reconciled with the shared receipt; ADR 0006:66-69 confirmed unchanged. |
| V10 | checks.sh [6] | passed: distinct broken variants (`JOINT_AMENDMENT_BROKEN`, `TASK_HOLD_BROKEN` for held, all-remaining-held and time limit); lifecycle table has a release row per hold source and waiting state; the time limit covers re-check, unavailable Forger, lapsed admission. |
| V11 | `rg -n -i "evidence dependenc\|evidence_dependenc\|mandatory dependenc\|same-Project Evidence\|family current tables\|Evidence recheck\|any exact decision\|new current revision\|Decision changed\|exact equality\|any mandatory dependency" docs/adr PRODUCT.md CONTEXT.md` | passed: every hit noted, amended or unrelated (below). One fix during the run: ADR 0017:135 was added to the amendment's named sentences. |
| V12 | checks.sh [7] | passed. |
| V13 | checks.sh [5] | passed: ADR 0022 owns `pending \| complete \| empty \| truncated \| failed \| not-run(reason)`; unreadable decision row → `failed`; ADR 0017:96 unchanged; failed capture never `empty`. |
| V14 | checks.sh [4] | passed: event child, echo rows, row answers and search candidates, contest/withdrawal/routing records and diagnostics hold no decision text, excerpt or path. One fix during the run: the explicit row-answer/candidate sentence was added to ADR 0022 "Records". |
| V15 | `rg -c "Provisional: binding now; revisited only when Pedro asks \(decisions log §93, C8\)\." docs/adr PRODUCT.md CONTEXT.md`; `rg -n "Provisional:" … \| rg -v <exact label>`; `rg -n -i "first real use\|after (first\|real) use\|usage trigger" docs/adr PRODUCT.md CONTEXT.md`; checks.sh [2] | passed: 6 labels (ADR 0011 ×1 joint-only closure; ADR 0017 ×1 Evidence floor; ADR 0022 ×4 echo granularity/moment, search passes and funding, row layout and resolution, update hosting), no other `Provisional:` wording, no usage trigger; invariant list stated as not provisional in ADR 0022 and ADR 0017. |
| V16 | `rg -n -i -P "accepted decision(?! revision)"` over added lines | passed: two hits, both definitional or quoted (ADR 0017 "Names" definition; the Evidence-floor quote was rephrased to "accepted decision revisions" during the run). |
| V17 | `git diff -U0 -- docs/adr \| rg "^(\+\+\+\|@@)"`; per-file hunk starts for `PRODUCT.md`, `CONTEXT.md` | passed: each ADR has exactly one changed line (Status, line 3) plus one pure insertion (top note, or appended Amendment); `PRODUCT.md` hunks at 48, 52, 64-65, 80-81, 85-86, 100, 103-107, 111, 123, 129; `CONTEXT.md` hunks at 28, 33, 35, 37, 58, 60, 62-63, 66, 68, 71-73, 82, 123-124, 151 (new rows only), 161, 163-164, 166-167, 170 — all listed lines. |
| V18 | Traceability table below | passed: every brief Traceability row maps to an amendment clause and a D99 row; none unmapped. |
| V19 | checks.sh [3] + reading ADR 0021 "Kept Open" and "Records" | passed: provenance never authoritative, no storage chosen, no delivery beyond the involved Runs. |
| V20 | `rg -n "Waypoint parent\|Waypoint-parent\|waypoint-parent\|Feature"` over added lines | passed: 6 hits, all pre-existing words inside edited lines (`CONTEXT.md` "(Formerly Feature.)", "Waypoint-parent model change", the `waypoint-parent` identifier, `PRODUCT.md:86` "Waypoint-parent or Worker prompt sources"); no new prose use. |
| V21 | `git show --stat <commit>` | see "Post-commit". |
| V22 | checks.sh [4] + reading | passed: undo tables in ADR 0021 (dialogue, contest, budget, map-revision actions), ADR 0011 (hold, joint, change-Run, Request changes), ADR 0022 (decision actions, docs-update map revision); together they hold every row of brief G15; the spent-budget rule is stated once (ADR 0021) and referenced by the other two. |
| V23 | checks.sh [2] + `rg -n "wording-only\|wording only" docs/adr PRODUCT.md CONTEXT.md` | passed: the mark is set only by the user's direct Decisions-page edit; no proposal, checkpoint, follow-up or message shape carries it. |
| V24 | checks.sh [3] | passed. |
| V25 | checks.sh [11] | **passed for the candidate half** (5 Amendments `Status: Proposed (2026-10-16)`, 6 notes "(Proposed)", 11 Status suffixes "Proposed"). **Pending:** the flip to Accepted and its decisions-log record happen only on Pedro's acceptance. **Acceptance half passed (K21 flip, after Pedro accepted `cdcecce`, decisions log §100):** all 12 Status suffixes, 5 Amendment `Status:` lines, 7 note headings and 7 note `Status:` lines say Accepted; checks.sh V25 rows: 67 PASS, including 36 checks that no `Proposed` status remains. |
| V26 | checks.sh [6] | passed. |
| V27 | checks.sh [12] | passed: ADR 0013 union, ADR 0010:409 and :386, `CONTEXT.md:71`, :123-124, `PRODUCT.md:111`, ADR 0006 family list name `project-coordination`; owners, retry-authority child, partition, tables, gate consumer and absent fields stated. |
| V28 | checks.sh [5] | passed. |
| V29 | checks.sh [3] | passed. |
| V30 | checks.sh [6] + `rg -n -i "current pointer"` over the ADR 0017 amendment | passed: no decision member's staleness is tied to the decision's current pointer; ADR 0017:59, :86-88, :157, :171 carry the decision exception. |
| V31 | checks.sh [1] + reading | passed: technical agreements, thread events and Contest create no Attention item or Decisions-page entry except the rows Pedro decided (contest close, time limit, hold rows after a failed close, budget limits, reserve ask, C1 lines). |
| V32 | checks.sh [5] | passed. |
| V33 | checks.sh [5] | passed. |
| V34 | checks.sh [5] | passed. |
| V35 | checks.sh [3] | passed. |
| V36 | checks.sh [5] | passed. |

No row failed. V25 is pending its acceptance half by design (Q12). V21 is completed after the commit.

### V1 classification

- New or amended text: `PRODUCT.md:48, :85, :86, :103, :104, :111`; `CONTEXT.md:28, :35, :36, :46, :47, :89, :92, :142`; every hit inside a new note or Amendment (ADR 0007 note, ADR 0009 note, ADR 0011/0013/0021/0022 Amendments).
- Named by a dated note or Amendment (base lines): ADR 0006:102; ADR 0007:27, :69; ADR 0009:23, :30, :31, :48, :53, :72, :102, :122, :151, :152, :175, :178; ADR 0010:409; ADR 0013:19, :29, :182, :268, :292, :344; ADR 0021:20, :45, :53, :84, :92; ADR 0022:34, :43.
- Classified unaffected: ADR 0020:47, :89 (Run-scoped `sealed-invocation` proof role; ordering covers only arms that reach convergence), recorded in the ADR 0010 note.
- Unrelated: ADR 0008:73 (Resume checkpoint; Run-scoped by definition, Run-absent invocations have none).

### V6 classification

- Joint-excepted in ADR 0011 Amendment 1: ADR 0011:95, :127, :128, :130, :131, :133, :165, :215, :216; ADR 0007:34 (note); ADR 0021:58 (Amendment 1); `PRODUCT.md:105`, :129 (amended).
- Kept for single-Run: ADR 0007:32 (status list unchanged), :47 (command list; joint commands added by note).
- Hit lines above are mapped back to base lines (commit `1b2256a`) where a top note shifted them.
- Unrelated: ADR 0008:45 (scope violation closes dispatch); ADR 0012:45 (discipline exception, outside the set); ADR 0015:33, :47 (Run-resource activation, Worker result-pending), :83 (Candidate change request).

### V11 classification

- Amended in place: `PRODUCT.md:64`; `CONTEXT.md` Verified memory, Memory Revision, Mandatory Memory Evidence dependency, Effective Memory trust, Memory Retrieval.
- Named by ADR 0017 Amendment 1: ADR 0017:9, :20, :47, :53, :59, :60, :63, :86, :87, :88, :113, :129, :135, :138, :144, :157, :171, :172 (the :45 heading and :180 consequence hold for both member kinds unchanged).
- Named elsewhere: ADR 0011:10 (ADR 0011 Amendment 1); ADR 0022:49 (superseded by ADR 0022 Amendment 1); ADR 0006 note line (new).
- Unrelated: ADR 0010:328 (Evidence reverse dependencies); ADR 0011:236 (`run_approval_proposal_evidence_dependencies`); ADR 0014:39, :163, :229 (Findings); ADR 0018:216 (Artifact removal); ADR 0020:93, :142-146, :180, :189 (Convergence bundle's own equality and dependencies).

## Traceability (V18)

| Source | Amendment clause | Check |
| --- | --- | --- |
| FR1 | unchanged (ADR 0007:31; `PRODUCT.md:109`) | V17 |
| FR2 | ADR 0021 A1 "Linked Pairs And Admission"; ADR 0006 note :82-85 | V35 |
| FR3 | ADR 0021 A1 "Supervisor-Detected Conflicts", "Run-Absent Invocations"; ADR 0009 note; ADR 0013 A1 | V35, V4 |
| FR4 | ADR 0011 A1 "Task Hold", "Hold Lifecycle"; ADR 0007, 0008, 0009 notes | V6, V8, V10 |
| FR5 | ADR 0021 A1 "Technical Agreement", ":45"; `PRODUCT.md:103` | V2, V3, V19, V31 |
| FR6 | ADR 0011 A1 "Joint Amendment Set", "Commands" | V33, V6-V9 |
| FR7 | ADR 0011 A1 "Unapprovable State: `changed`" | V33, V8, V10 |
| FR8 | ADR 0021 A1 "A Waypoint Without A Run"; ADR 0011 A1 ":125-126", prerequisites | V28, V2 |
| FR9, FR10 | ADR 0021 A1 "Coordination Budgets"; ADR 0006 note | V34, V4, V26 |
| FR11, FR12 | ADR 0017 A1 "Decision Dependency Member", "Trusted Read", "Decision Change Event" | V11, V13, V16, V30 |
| FR13 | ADR 0022 A1 "Decision Echo Record"; ADR 0015 note | V36, V12, V14 |
| FR14 | ADR 0022 A1 "Change-Time Search"; ADR 0013 A1; ADR 0010 note | V36, V4, V13 |
| FR15 | ADR 0022 A1 "The Single Decision-Change Item", "Update Work" (:49 superseded) | V24, V22, V36 |
| FR16 | ADR 0022 A1 "Meaning Version And Wording Only" | V29, V23 |
| FR17 | ADR 0022 A1 "Retirement" | V11, V30 |
| NFR Performance | ADR 0021 A1 "Coordination Budgets" | V4, V34 |
| NFR Security | ADR 0021:44 kept; ADR 0022 A1 wording-only rule | V2, V23 |
| NFR UX | ADR 0021 A1 "Technical Agreement", budgets warning; `PRODUCT.md:48` | V31 |
| NFR Reliability | ADR 0011 A1 "Diagnostics"; ADR 0017 A1 "Trusted Read" | V10, V13, V30 |
| AC1 | ADR 0021 A1 "Linked Pairs And Admission" | V35 |
| AC2 | ADR 0011 A1 "Task Hold", "Unaffected Work Keeps Running" | V6, V10 |
| AC3 | ADR 0021 A1 "Technical Agreement" | V31 |
| AC4, AC5 | ADR 0011 A1 "Joint Amendment Set", "Commands", `COMPONENT_SUPERSEDED` | V33 |
| AC6 | ADR 0021 A1 "A Waypoint Without A Run" (change-Run proposal) | V28 |
| AC7 | ADR 0021 A1 "Coordination Budgets" | V34, V4 |
| AC8 | ADR 0017 A1; ADR 0022 A1 "The Single Decision-Change Item" | V30, V24 |
| AC9 | ADR 0022 A1 "Meaning Version And Wording Only" | V29 |
| UD1, UD2 | ADR 0021 A1 "Technical Agreement", ":45"; `PRODUCT.md:103` | V2, V3, V31 |
| UD3 | ADR 0011 A1 "Joint Components", "Unaffected Work Keeps Running" | V6, V33 |
| UD4 | ADR 0022 A1 "The Single Decision-Change Item" | V24 |
| UD5 | ADR 0022 A1 "Meaning Version And Wording Only" | V29 |
| UD6 | ADR 0021 A1 payer table | V4, V34 |
| C1 | ADR 0021 A1 "Approval moment"; ADR 0011 A1 "Coordination-Budget Lines" | V26 |
| C3 | ADR 0021 A1 "Reserve at its limit" | V34 |
| C4 | ADR 0021 A1 "Contest"; undo table | V32, V22 |
| C5 | ADR 0011 A1 "Joint Components" (provisional label) | V6, V15 |
| C6 | ADR 0011 A1 "Hold Lifecycle", re-check dialogue | V10, V33 |
| C7 | ADR 0011 A1 "Approval" (:130, :133, :165 for joint) | V6 |
| C8 | ADR 0022 A1 "Provisional Scope"; six labels | V15 |
| C9 | ADR 0022 A1 Run rows; undo table | V24, V22 |
| C10 | ADR 0022 A1 "Update Work"; undo table | V36, V22 |
| C11 | ADR 0022 A1 "Mark as meaning changed"; undo table | V29, V22 |
| G11 | ADR 0022 A1 row rule | V24 |
| G15 | ADR 0021, 0011, 0022 A1 undo tables; spent-budget rule | V22 |
| R1, Q1 | ADR 0013 A1; ADR 0010 note | V27, V4 |
| R3, R21, Q3 | ADR 0011 A1 "Joint Amendment Set"; ADR 0021 A1 proxy | V28 |
| R4, G14 | one slice, one commit | V21 |
| R9, Q2 | ADR 0021 A1 "Contest"; ADR 0011 A1 lifecycle | V32 |
| R10, Q9 | ADR 0011 A1 "Held-task time limit"; ADR 0021 A1 end reasons and defaults row | V10, V5 |
| R15 | ADR 0021 A1 payer table | V4 |
| R17 | ADR 0021 A1 "Run-Absent Invocations"; ADR 0022 A1 :43; ADR 0009 note; ADR 0013 A1; ADR 0010 note | V12, V27, V36 |
| Q7 | ADR 0021 A1 "Onboarding always raises that ask" | V26 |
| Q12 | all Status lines and sections Proposed | V25 |
| Q21 | `CONTEXT.md` copy rows | V8 |
| FRD OQ1 | ADR 0021 A1 "Kept Open" | V19 |
| FRD OQ2 | ADR 0011 A1 "Task Hold"; ADR 0007, 0009 notes | V2, V8, V10 |
| FRD OQ3 | ADR 0021 A1 defaults rows (open) | deferred |
| Research design questions | ADR 0021 A1 (pair shape, thread owner, map change, Supervisor contract, "no active Run"); ADR 0011 A1 (joint shape); ADR 0022 A1 (retire, echo moment, search owner, hosting) | V2, V27, V33, V36 |

## Deviations and notes

- Fixes made during verification (before the commit, not review rounds): ADR 0011 amendment names :216 and :212-217 (V6); ADR 0017 amendment names :135 and qualifies the Evidence-floor quote (V11, V16); ADR 0022 "Records" states the row-answer privacy rule explicitly (V14).
- The `--finalizing` fence deviation of the brief (§96) is unchanged; the brief body is not edited. Its Developer Context gains one appended entry ("Implementation (c99-s1, 2026-10-16)"). `append-only.mjs <approved copy> <brief>` → `append-only: keep` (exit 0) before and after the re-stamp. `validate-artifact.mjs --finalizing --stamp` refused with the known §96 error ("code fence over 10 lines at line 168: 11 lines") and wrote nothing; `validate-artifact.mjs --stamp` then stamped `content_hash 7e89b82ff33e665f8164999cd5c80d0f80d78a2016cb29957d314800f13883be`, and plain validation returns `OK`.
- `pnpm check` ran 3m55s. The coordinator's brief requires it; no other heavy run was made.

## Post-commit

A commit cannot contain its own SHA. The commit SHA, `git show --stat` (V21) and `lane.mjs --range 1b2256a..<sha>` are reported to the coordinator with the candidate and belong in the candidate-review evidence.

## Fix round 1 (review round 1 on `a7c6625`, table K1-K21, decisions log §97)

Inputs: `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/review-candidate-round1.md` (main checkout); decisions log §97 (Pedro: K5, K6, K7, K2, K21; the coordinator approved K13's extra lines). The round-1 results above stay as history; this section records the fix round on the same branch, applied as one fix commit.

| Row | Status | What changed |
| --- | --- | --- |
| K1 | fixed | ADR 0011 A1 "only X" list adds :134, :277, :287 and ADR 0007:60, :98 (contained Model-change requests move to `approved-pending-apply`); the ADR 0007 note names :60, :81, :98. New K1 sweep below. |
| K2 | fixed | ADR 0019 joins the set (dated note, Status suffix): sixth limit-owner arm `decision-search-capture-request` (:97, :139-142, :170) and the fourth capture source (:143, :190). ADR 0010 note: the source union (base :401, :439, :440) gains `decision-search-capture`; the observation never advances `integration_target_current_evaluations`; origin kinds (:417) unchanged, the Artifact is `evidence-produced` (Evidence-owned); requester widened to Foundation inference. ADR 0015 note: :117 gains `RequestDecisionSearchCapture` and `RecordDecisionSearchCaptureOutcome`. `PRODUCT.md:124` amended. "Integration-owned Artifact" corrected in ADR 0006, 0010, 0021 and `CONTEXT.md`. |
| K3 | fixed | ADR 0022 A1: owner records for the update row (`decision_follow_up_proposal_decisions`) and the Begin row (`decision_follow_up_run_links`, plus a "Skip this Waypoint" answer); a resolution rule for every row kind; an item resolution rule; an undo row for Skip. V24 checks every row kind. |
| K4 | fixed | ADR 0011 A1: a covered Run with an epoch keeps its state through joint approval (`paused` stays paused); names :133, :217 and ADR 0007:34 as the replaced results; `initial` components follow :129 and :214. |
| K5 | fixed (§97) | ADR 0011 A1 lifecycle rows: the change-Run wait with "Decline" (`released-on-change-run-declined`; a pending one-Run set goes `changed` with `PREREQUISITE_CHANGED`), `PREREQUISITE_RUN_STARTED` carries the holds, an unavailable Supervisor proxy falls under the time limit, a Contest hold is released when its Run ends; an undo row for Decline; matching ADR 0021 A1 text. Recorded in the brief's Developer Context ("Candidate review round 1"). |
| K6 | fixed (§97) | ADR 0013 A1 no longer bans `process-execution` or lists Process job as absent, and points to issue #136. The ADR 0008 note, ADR 0021 A1, `CONTEXT.md` Project-coordination effect and `PRODUCT.md:111` point to #136. |
| K7 | fixed (§97) | ADR 0022 A1 names :48: a decision edit still pauses nothing; a following conflict dialogue may hold only affected tasks through an admitted Forger hold proposal. |
| K8 | fixed | Each restatement points to its owner's label: `PRODUCT.md` :48, :100, :105, :123; `CONTEXT.md` Run amendment proposal, Decision echo, Decision echo search, Decision-change item, Mandatory Memory Evidence dependency; ADR 0021 A1 (:57-58 bullet and the payer table). V15 re-run below. |
| K9 | fixed | `CONTEXT.md` Strand: "may have one Strand coordination budget, which Execution owns". |
| K10 | fixed | `SubmitJointRunAmendment` creates the narrowed `run-amendment` Control request (`SubmitRunAmendmentRequest` never does); :246 added to the complete-classification list. New K10 sweep below. |
| K11 | fixed | ADR 0010 note: `member_source_kind` gains `continuing-result` with `candidate_delta_member_continuing_results` (base :400, :437); the ADR 0015 note links it. |
| K12 | fixed | `PRODUCT.md:105`: "moves no Run that already had an epoch to another status (an `initial` component ends `ready` or `blocked` and still needs Start)". |
| K13 | fixed | `PRODUCT.md:112` retry authority adds Run-absent invocation authority; `CONTEXT.md` Effect dossier adds Run-absent owner state; ADR 0013 A1 adds an index rule for :298. The lines beyond the list are approved by the coordinator. |
| K14 | fixed | `CONTEXT.md` Technical agreement adds "needs no new decision"; `PRODUCT.md:48` adds "or are information only"; `CONTEXT.md` search outcomes use `not-run(reason)`; `CONTEXT.md` Contest aligned with the "two user-visible release paths" and the Run end. Owner-copy pair checks below. |
| K15 | fixed | ADR 0021 A1 payer child is a two-arm union: `coordination-budget` (phase 2) or `run-budget` (phase 1, :52). |
| K16 | fixed | "exactly two user-visible release paths", plus the joint-set rows and the Run end. |
| K17 | fixed | ADR 0010 note: the capture Artifact has generated-output retention, and its open request is a byte hold (ADR 0018). |
| K18 | fixed | The ADR 0009 note covers Amendment 1 :288-289 (budget units). |
| K19 | fixed | ADR 0009 note precedent corrected to "pause and resume"; sequence and retry-authority ownership include `conflict-scan` and `decision-follow-up`; stable codes `DIALOGUE_ADMISSION_BROKEN`, `COORDINATION_BUDGET_BROKEN`, `CONFLICT_DETECTOR_BROKEN`; `CONTEXT.md` Plan-changing agreement wording. Line-label slips found and corrected: ADR 0010 note (:385/:424 → :401/:439/:440) and ADR 0019 note (:144 → :143; :144 is the index rule). The review table does not list the slips, so no other labels were re-audited one by one. |
| K20 | fixed | `RejectJointRunAmendment` states `RejectRunPreparation`'s write set (:128, :213) for `initial` members; the privacy sentences of ADR 0021 and ADR 0022 are narrowed to their records and the diagnostics each amendment owns. |
| K21 | process, not applied here | Pedro (§97): after acceptance, the Proposed→Accepted flip is a coordinator-checked diff. |

### Re-run on the fixed tree (cwd = worktree, uncommitted fix round on top of `a7c6625`)

| Check | Command | Result |
| --- | --- | --- |
| Content checks | `bash checks.sh <worktree>` (updated script below) | passed: **243 PASS, 0 FAIL**, exit 0. That is the 152 D99 checks, 7 of them with strings updated for deliberate wording changes, plus 91 K checks, 11 of which check that a string is absent (corrected in "Fix round 2"; first written as 13). |
| V1 | same command as in round 1 | passed: new hits only in new amendment text (ADR 0011 A1 budget lines, ADR 0013 A1 index rule, ADR 0021 A1 payer union); other hits unchanged, only shifted by the longer notes. |
| V6 | same command | passed: new hits only inside ADR 0011 A1 (joint text); the ADR 0015 hits moved to lines 50, 64, 100 (base :33, :47, :83, unrelated). |
| V11 | same command | passed: classification unchanged (ADR 0010:351 = base :328, unrelated). |
| V15 | exact-label count, other `Provisional:` wording, `rg -c "provisional: see the label in"`, usage-trigger sweep | passed: still 6 exact labels and no other `Provisional:` wording; 10 pointer lines (`PRODUCT.md` 4, `CONTEXT.md` 5, ADR 0021 1) plus the ADR 0021 payer-table pointer; no usage trigger. |
| V16 | `rg -n -i -P "accepted decision(?! revision)"` over all lines added since `1b2256a` | passed: the "Names" definition, plus the pre-existing "accepted decision/version" (an Effect decision) inside the edited `PRODUCT.md:112`. |
| V17 | hunk shape since `1b2256a` | passed: each of the 12 ADRs (now including 0019) has one Status line plus one insertion. `PRODUCT.md` hunks: 48, 52, 64-65, 80-81, 85-86, 100, 103-107, 111-112, 123-124, 129. `CONTEXT.md` adds hunk 80 (Effect dossier). `PRODUCT.md:112`, `PRODUCT.md:124` and base `CONTEXT.md:80` are the K2/K13 lines approved in §97 and by the coordinator. |
| V20 | same command | passed: the same 6 pre-existing words. |
| K1 sweep | ``rg -n "[Oo]nly `ApproveRunAmendment`\|amendment approval alone\|only generic Run amendment approval\|[Oo]nly `ApproveRunPreparation` (and\|or) `ApproveRunAmendment`\|created by `ApproveRunAmendment`\|only by `Approve\|alone creates\|alone may\|ApproveRunAmendment` (validates\|fills\|may)" docs/adr PRODUCT.md CONTEXT.md`` | passed. Named: ADR 0011:22, :134, :277, :287; ADR 0007:60, :81, :98; ADR 0009:124, :183. Amended: `PRODUCT.md:107`, `CONTEXT.md` Model change. Unrelated: ADR 0007:55 (`AcceptWorkerResult` alone), ADR 0012:44, ADR 0018:192, ADR 0020:46 (a proof role, not an epoch creator). |
| K10 sweep | `rg -n "every prior task\|classify every prior\|each prior task\|exactly once\b.*prior\|every prior-work\|own every prior" docs/adr PRODUCT.md CONTEXT.md` | passed: every hit is named in ADR 0011 A1 (:54, :140, :246, :250) or amended (`PRODUCT.md:105`, `CONTEXT.md` Run amendment proposal). |
| K14 owner-copy pairs | checks.sh rows `K14` | passed: the technical-agreement bound, information-only rows, `not-run(reason)`, the Contest release paths and the Effect-subject list each match between owner and copies. |
| Fast gate | `pnpm check` | passed (exit 0): 83 files / 3024 tests, depcruise clean; 1m25s. |
| Duplicates | `pnpm check:duplicates` | passed (exit 0), 0 clones. |
| Dead code | `pnpm knip` | passed (exit 0), no output. |
| Brief | `append-only.mjs <approved copy> <brief>`; `validate-artifact.mjs --stamp`, then plain validate | `append-only: keep`; stamped `content_hash 4a75fb3e72763a6ebde8ab2d6cb417f227736927496e785e008e463694d2166e`; validate `OK`. `--finalizing` still refuses the §96 fence. |

Every D99 check re-ran in the content script. V21 (now one slice commit plus one fix commit, on the coordinator's instruction) and V25's acceptance half stay as stated above.

## Fix round 2, final (review round 2 on `bb28854`, table L1-L14, decisions log §98)

Inputs: `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/review-candidate-round2.md` (main checkout); decisions log §98 (Pedro: L1 "follow ADR 0018 as it is"; one final fix commit with no third review round; the coordinator checks every item). Earlier sections stay as history, except the two corrections marked below.

**Corrections to "Fix round 1" (L13):** that section said 13 of the 91 K checks were must-be-absent checks; the real count was **11**. Its `n()` helper also counted an `rg` error as an absence, against `degrade-distinguishes-broken`; the helper now reports an `rg` error (exit 2) as a FAIL. In the K1 sweep, the ADR 0012:44 hit is unrelated: it matched `Only \`ApproveDisciplineException\``, which approves a Discipline exception and creates no epoch.

| Row | Status | Where the fix lives (file and current line on the fix-round tree) |
| --- | --- | --- |
| L1 | fixed (§98) | ADR 0010 note "Retention" bullet (`docs/adr/0010-…md:24`): ADR 0018 applies unchanged, `evidence-produced` → `durable-record`, no new hold kind; the "typed byte hold" sentence is removed. `PRODUCT.md:124` copy ("a durable record"). ADR 0018 is not edited. |
| L2 | fixed | ADR 0010 note, new bullet naming base :326, :384, :415 (`0010-…md:25`); `CONTEXT.md:117` (Approved Evidence limit owner, sixth arm); ADR 0019 note names base :185 and :190 and records ADR 0020:98 as a stale count, not edited (`0019-…md:14`). |
| L3 | fixed | ADR 0011 A1 Decline bullet (`0011-…md:340`: every change-Run proposal, `change_run_proposals`, `DeclineChangeRunProposal`, `change_run_proposal_decisions`, no re-check after a Decline); `DeclineChangeRunProposal` command row; lifecycle row "Joint set goes `changed` (any cause except a Decline)"; physical records; ADR 0021 A1 (cancelled/failed/superseded bullet); ADR 0007 note command list. |
| L4 | fixed | ADR 0022 A1 Row answers (`LinkDecisionFollowUpRun` writes `decision_follow_up_run_links`), search row "both passes", item stays open while a pass is `pending`, new undo row for "Undo skip"; ADR 0006 note lists the three K3 tables. |
| L5 | fixed | ADR 0011 A1 `RejectJointRunAmendment` row (narrowed request and contained Model-change requests → `rejected`), `SettleJointRunAmendmentChanged` row (→ `superseded`, ADR 0007:81), Approval bullet (request applied, Model changes → `approved-pending-apply`). |
| L6 | fixed | ADR 0011 A1 lifecycle "Contest hold" row now says "the two user-visible paths, or by the Run-end row below"; the V10 check string is updated. |
| L7 | fixed | ADR 0011 A1 "Run status" bullet: at approval the evaluator changes condition codes only, never status; afterwards ADR 0007 transitions apply; a never-started `blocked` Run reaches `ready` and needs `StartRun`. ADR 0007 note adds ":33-35 (lifecycle paths)". |
| L8 | fixed | `CONTEXT.md` Change-Run proposal (Begin or Decline), `CONTEXT.md` Contest (out of new Sealed Invocations while contested; only a withdrawal returns it), ADR 0013 A1 "Effect Dossier (:203)" bullet matching `CONTEXT.md` Effect dossier; the pairs are added to the K14/L8 checks. |
| L9 | fixed | ADR 0021 A1 pointer under the payer table: "decision-search entries of this table (not Foundation inference) are provisional". |
| L10 | fixed | ADR 0010 note: the capture list now ends with the "Missing, truncated…" bullet, then a blank line, then the `continuing-result` block. |
| L11 | fixed | ADR 0019 note: "No headroom in v1" for the new arm (always the default; exhaustion stays truncated); the "headroom … :107" sentence is removed. |
| L12 | fixed | ADR 0006 note: Integration owns the capture request and commands, Evidence the target observation, its source child, limit binding and Artifact. ADR 0011 A1 ":10" bullet carries the K7 reading. ADR 0011 A1 joint-component bullet now says "each non-`initial` component", the same as the command row, and an incompatible component rejects the whole submission with `RUN_AMENDMENT_INCOMPATIBLE` (receipt-only, as :131). ADR 0010 note: a capture never moves the `latest_*` pointers either. |
| L13 | fixed | `checks.sh` `n()` fails on an `rg` error; corrected counts (above); the K21 flip list is 12 ADRs (5 Amendment sections, 7 dated notes); the V25 check now also covers the ADR 0019 note (12 ADRs). |
| L14 | fixed | Every header and note range now reads `§90-§98`; the duplicate "no tools" is removed in ADR 0021 A1 ("Run-Absent Invocations"); the ADR 0009 note adds ":32 (provider-neutral cycle)". |

### Re-run on the final fix-round tree (cwd = worktree, uncommitted on top of `bb28854`)

| Check | Command | Result |
| --- | --- | --- |
| Content checks | `bash checks.sh <worktree>` (updated script below) | passed: **309 PASS, 0 FAIL**, exit 0: 153 D99 (V25 now 12 ADRs), 91 K, 65 L; 39 must-be-absent checks (11 K, 28 L). An `rg` error now fails (seen once while writing the L10 check, then fixed by using multiline mode). |
| V15 | exact labels, other `Provisional:` wording, pointer count | passed: 6 exact labels, 0 other `Provisional:` lines, pointer lines `PRODUCT.md` 4, `CONTEXT.md` 5, ADR 0021 2. |
| V17 | hunk shape since `1b2256a` | passed: 12 ADRs, each one Status line plus one insertion; `PRODUCT.md` hunks unchanged from round 1; `CONTEXT.md` adds base hunk 98 (Approved Evidence limit owner, named by the coordinator for L2). |
| V6, V1 | sweeps | passed: the only new hits are inside ADR 0011 A1 joint text (lines 344, 346, 348, 427, 429). |
| Brief | `append-only.mjs <approved copy> <brief>`; `--stamp`, then plain validate | `append-only: keep`; `content_hash 58167ac5c4d8dafaa2260a9c4deaf70820887c1d4df40539daa33efc083ce65d`; validate `OK`. |
| Fast gate | `pnpm check` | **failed (exit 1), one timeout:** `apps/desktop/src/renderer/conversation/project-conversation.test.tsx` "CNV-B31 … shows every page in cursor order after mount and after a new activation", "Test timed out in 5000ms" (5641ms; the effective timeout is the Vitest default of 5000ms, with no per-test override). 3023 of 3024 tests passed; format, lint, typecheck passed; depcruise did not run after the failure. No code file is touched by this slice, and the same test passed in the two earlier runs. CPU was about 60% at the time, as the coordinator checked. Reported to the coordinator before any rerun (gate-timeout rule). |
| Fast gate, rerun | `pnpm check` (one rerun, Pedro's decision, decisions log §99) | **passed** (exit 0): 83 files / 3024 tests passed, including CNV-B31; format, lint, typecheck and depcruise clean; 44s. Nothing else was run after it, per that decision. The first run's timeout (5641ms against the 5000ms default) stays recorded above as a failed run. |
| Duplicates | `pnpm check:duplicates` | passed (exit 0), 0 clones. |
| Dead code | `pnpm knip` | passed (exit 0), no output. |

## K21 flip (after acceptance, decisions log §100)

Pedro accepted the candidate `cdcecce` directly (decisions log §100). The flip is mechanical: 31 lines in 12 ADRs (12 Status-line suffixes, 5 Amendment `Status:` lines, 7 dated-note headings, 7 note `Status:` lines) change `Proposed` to `Accepted`; no other line changes. Only the two pre-existing uses of the word (ADR 0009 "Proposed versus final Tool arguments" and ADR 0022 "Proposed decisions are shown grouped") remain. `checks.sh`: 364 PASS, 0 FAIL (V25 now checks the accepted state). Gates on the flipped tree are reported to the coordinator with the commit SHA.

## checks.sh

Reproduce: save the block as `checks.sh` and run `bash checks.sh <worktree>`; it prints one PASS/FAIL line per fixed string (and per must-be-absent string; an `rg` error is a FAIL) and exits 1 on any FAIL. Final result: 309 PASS, 0 FAIL before the flip; 364 PASS, 0 FAIL after it (V25 acceptance half). Earlier versions are in commits `a7c6625` (152 checks) and `bb28854` (243 checks).

```bash
#!/usr/bin/env bash
# Usage: checks.sh <repo-root>. Prints one PASS/FAIL line per required fixed string.
cd "$1" || exit 2
fail=0
c() { # id file string
  if rg -q -F -- "$3" $2; then echo "PASS $1 [$2] $3"; else echo "FAIL $1 [$2] $3"; fail=1; fi
}
A21=docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md
A11=docs/adr/0011-approved-run-preparation-and-amendment-authority.md
A13=docs/adr/0013-effect-reconciliation-and-recovery-journal.md
A17=docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md
A22=docs/adr/0022-decision-scope-and-implementing-waypoints.md
A06=docs/adr/0006-physical-persistence-layout.md
A07=docs/adr/0007-supervised-execution-aggregate-ownership.md
A08=docs/adr/0008-run-workspace-mutation-lease-and-process-job-lifecycle.md
A09=docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md
A10=docs/adr/0010-typed-evidence-ledgers-and-atomic-current-evaluations.md
A15=docs/adr/0015-parallel-worker-candidate-composition-and-exact-integration.md
P=PRODUCT.md; X=CONTEXT.md

# V2 authority paths stay literally true; admission, routing, hold sources
c V2 $A21 "A message reaches another agent only as an Invocation context source of a new kind, **agent-authored**, with trust \"no authority\". Agent messages never approve, never relay human approval, and never move canonical state"
c V2 $A21 "The Supervisor plans and coordinates; it never changes files, approves anything, or starts a Run."
c V2 $A21 "A Supervisor that starts Runs on its own: it removes the user's Begin authority."
c V2 $P "Manual Actions create a Run only through Begin"
c V2 $A21 "one application routing event per message"
c V2 $A21 'through a recorded `map-link` admission'
c V2 $A21 'needs a recorded `supervisor-admission`'
c V2 $A11 "Message text never places a hold."
c V2 $A11 "a **typed Forger hold proposal**, which the deterministic coordinator validates"
c V2 $A22 "The Supervisor starts nothing."
c V2 $A21 "It starts nothing (:34, :91"
# V3 technical-agreement test
c V3 $A21 "(ADR 0011:84)"
c V3 $A21 "no change to any node-fingerprint input of ADR 0011:91: role, purpose, contract-clause links, result schema, model-selection rule, Project-profile requirements, tool schema hashes, effect scopes, workspace or input requirement, budget and limit allocations, risk class, approval requirements, completion handoff"
c V3 $A21 "no added power (ADR 0011:174)"
c V3 $A21 "no contradiction of a current accepted decision revision"
# V4 payer table
c V4 $A21 "| Hand-over, Contest and re-check dialogues | The original dialogue's payer |"
c V4 $A21 "the Project reserve while that Strand has no budget yet"
c V4 $A21 "or the Project reserve while that Strand has none yet"
c V4 $A21 "| Decision follow-up proposal turn | The payer of its decision's search |"
c V4 $A21 "| Project-scope decision search; Foundation inference | Project reserve |"
c V4 $A21 "Cross-Waypoint Forger turns never debit a Run."
c V4 $A21 "missing usage is pending, never zero"
c V4 $A21 'Each Run-absent provider dispatch has exactly one `project-coordination` Effect subject'
# V5 codes and reasons
for s in DIALOGUE_ADMISSION_CHANGED COORDINATION_BUDGET_EXHAUSTED COORDINATION_BUDGET_MISSING counterpart-run-started counterpart-run-ended hold-time-limit-reached budget-left-unchanged; do c V5 $A21 "\`$s\`"; done
c V5 $A21 '"Not checked" (`not-run`) and "check failed" (`failed`) stay distinct from "no conflict"'
c V5 $A21 'none ever reads as "admitted", "within budget" or "no conflict"'
# V7 complete-classification sentences
c V7 $A11 ":35, :54, :140, :152, :166, :168, :223, :246, :250, :288; ADR 0015:48, :133, :148, :150-151"
c V7 $A15 '`continuing-result`'
c V7 $P 'classifies every other task `unaffected-continuing`'
c V7 $X 'A joint component instead classifies each unaffected task `unaffected-continuing` (joint-only scope'
# V8 kinds, shapes, states, sealing, copy
c V8 $A07 ':79: Control-request kinds gain `task-hold`. Target shapes (:77) are unchanged.'
c V8 $X "a task hold targets the Run and lists exact held Delegation tasks"
c V8 $A11 "Target shapes stay unchanged (ADR 0007:77)"
c V8 $A11 "No new Run status and no new Run cause (ADR 0007:32, :43 untouched)"
c V8 $A11 'is refused with `JOINT_COMPONENT_STATE_INVALID`'
c V8 $A11 "The only command that seals joint components."
c V8 $A11 '`stale` stays reserved for accepted authority (:183-184)'
c V8 $X '"proposta ultrapassada"'
c V8 $X '"tempo de espera esgotado"'
c V8 $X '"desatualizada"'
# V9 receipts
c V9 $A11 "The receipt sentences :37, :38, :60, :224 and :248"
c V9 $A11 "ADR 0006:66-69 already allows several events on one receipt, and is unchanged."
c V9 $A06 ":66-69 is unchanged"
# V10 broken variants and lifecycle
c V10 $A11 '`JOINT_AMENDMENT_BROKEN`, never `changed` or approvable'
c V10 $A11 '`TASK_HOLD_BROKEN`, never "no tasks held"'
c V10 $A11 'never "not held" or "within the limit"'
c V10 $A11 "a \`changed\` set's re-check, a dialogue waiting on an unavailable Forger or an unavailable Supervisor proxy (decisions log §97, K5), and a dialogue whose admission lapsed"
c V10 $A11 "| Waiting on an unavailable Forger or an unavailable Supervisor proxy, or a lapsed admission |"
c V10 $A11 "| Contest hold | released on technical re-agreement or the user's \"Withdraw contest\" (\`released-on-contest-withdrawn\`), the two user-visible paths, or by the Run-end row below"
# V12 ownership
c V12 $A17 "The decision owner never queries Memory"
c V12 $A17 "Memory never moves a decision pointer."
c V12 $A22 "Integration never writes decision or echo state."
c V12 $A15 "Integration never writes decision or echo state."
c V12 $A21 "The Supervisor never reads code"
c V12 $A21 "The Project agent has **no tools**."
c V12 $P "writes nothing, and serves Foundation inference"
# V13 outcomes
c V13 $A22 '`pending`, `complete`, `empty`, `truncated`, `failed` and `not-run(reason)`'
c V13 $A22 'Nothing but `empty` may display as "no documents found"'
c V13 $A22 "ADR 0017:96 is unchanged."
c V13 $A17 'An unreadable decision row returns `failed`, never empty or trusted'
c V13 $A10 'a search over a failed capture is `failed` or `not-run`, never `empty`'
# V14 privacy
c V14 $A17 "The payload holds identities, versions and hashes only: no decision text, excerpt or path"
c V14 $A22 "Echo rows hold ids, hashes and the anchor only"
c V14 $A22 "These rows, the change event child, the echo search candidates and the diagnostics this amendment owns hold identities"
c V14 $A21 "Contest records, withdrawal records, routing events and the diagnostics this amendment owns hold identities, versions and hashes only"
# V15 invariants not provisional
c V15 $A22 "These safety invariants are **never provisional**"
c V15 $A17 "These rules are safety invariants and are never provisional"
# V19 FRD Q1 open
c V19 $A21 "No text here chooses a storage, makes the provenance arm authoritative, or delivers technical agreements beyond the involved Runs."
c V19 $A21 "Provenance never enters an authority reference (ADR 0011:44)."
c V19 $A21 "It never reaches other Runs."
# V22 undo tables
c V22 $A21 "### User Actions And Their Undo"
c V22 $A11 "### User Actions And Their Undo"
c V22 $A22 "### User Actions And Their Undo"
c V22 $A21 "**Spent budget rule.** Any user action that starts paid turns records the spend as irreversible. It asks for confirmation only when the payer is at or above its 80% warning."
# V23 wording-only user-only
c V23 $A22 "Only the user's direct edit command on the Decisions page can set the mark. No Supervisor proposal, Decision checkpoint, decision follow-up proposal or agent message has a field for it"
c V23 $P "Only the user's direct edit on this page may carry the wording-only mark"
# V24 rows
c V24 $A22 "A row holds exactly one decision point with its listed alternatives, or is information-only."
c V24 $A22 'Row answers** are owned by the decision owner in `decision_change_row_answers`'
c V24 $A22 "Run row: the Run is terminal, its epoch pins the current meaning version, or the user kept the earlier version"
# V25 proposed in candidate
for f in $A21 $A11 $A13 $A17 $A22; do c V25 $f "- Status: Accepted (2026-10-16)"; done
for f in $A06 $A07 $A08 $A09 $A10 $A15 docs/adr/0019-measured-evidence-result-limits-and-approval-authority.md; do c V25 $f "## Note (2026-10-16): amended by the #99 phase 2 amendment set (Accepted)"; done
# V26 budget approval
c V26 $A21 "A Strand's budget is a sealed, separately hashed input of the first Run approval proposal"
c V26 $A21 "A Run approval carries the reserve line only while no approved reserve revision exists."
c V26 $A21 '`ApproveCoordinationReserve` with its own receipt'
c V26 $A21 "Onboarding always raises that ask for Foundation inference."
c V26 $A21 '`COORDINATION_BUDGET_PROPOSAL_CHANGED`'
c V26 $A11 "A Strand's coordination budget is a sealed, separately hashed input of the first Run approval proposal"
# V27 project-coordination in step
c V27 $A13 '| `project-coordination` | Exact Project; exact Run-absent invocation identity'
c V27 $A10 ':409 (closed scope kinds) gains `project-coordination`.'
c V27 $A10 'gains the one-to-one child `project_coordination_evidence_scopes`'
c V27 $X '`integration`, or `project-coordination` (ADR 0013 Amendment 1)'
c V27 $X '`project-operation`, or `project-coordination`; `project-operation` binds'
c V27 $P '`integration`, or `project-coordination`.'
c V27 $A06 'the `project-coordination` Effect subject (ADR 0013 Amendment 1)'
c V27 $A13 "**Execution** is the subject owner"
c V27 $A13 "Run, Forger, Worker, Delegation task, Run-workspace and mutation identities"
c V27 $A13 '`effect_retry_project_coordination_authorities`'
c V27 $A13 '**Partition** (:234). The arm lives in `slopstop.db`'
c V27 $A13 "**Gate consumer.**"
# V28 joint path with proxy
c V28 $A11 "For N ≥ 1 covered Runs"
c V28 $A11 'a sealed `pending` proposal condition of the set'
c V28 $A11 "It is never a task edge, a task input or a task-input source kind"
c V28 $A11 '`PREREQUISITE_RUN_STARTED`. That is a closing, not `changed`; the holds carry into the two-Run set.'
c V28 $A21 "the agreement re-enters as a **two-Run joint set**"
# V29 wording-only effects
c V29 $A22 'A wording-only revision emits no `decision-current-meaning-replaced` event, stales no memory, flags no document, runs no search and raises no per-Run row. The mark stays in the decision history.'
c V29 $A22 'refused with `DECISION_WORDING_ONLY_NOT_APPLICABLE`'
c V29 $A22 'it creates a new unmarked revision with the same text and runs the full change path'
# V30 meaning-version wording
c V30 $P "or a bound accepted decision revision's meaning version changes or the decision is retired"
c V30 $X "or a bound decision's meaning version changes or the decision is retired"
c V30 $X "every bound decision still at its meaning version and not retired"
c V30 $A17 "- :59 ("
c V30 $A17 "- :86-88 ("
c V30 $A17 "- :157 and :171 ("
# V31 no attention for technical agreements
c V31 $A21 "A technical agreement creates no Attention item and no Decisions-page entry."
# V32 contest
c V32 $A21 "the exact accepted \`DelegationTaskId\`s that Run's own Forger named"
c V32 $A21 "never silently dropped"
c V32 $A21 'A `contested` agreement is excluded from new Sealed Invocations.'
c V32 $A21 "A Contest hold has exactly two user-visible release paths"
c V32 $A21 "Contest is an immutable contest record"
# V33 joint set
c V33 $A11 "The set appears to the user as **exactly one** Attention item."
c V33 $A11 "Approve and Reject always decide all N components."
c V33 $A11 "plus: the set hash and cardinality; each member being its Run's current non-superseded pending proposal; each covered epoch equal to the bound epoch; no covered Run terminal or \`recovery-required\`; every prerequisite settled; every hold current"
c V33 $A11 '`EPOCH_MOVED`, `RUN_ENDED`, `COMPONENT_SUPERSEDED`, `RUN_RECOVERY_REQUIRED`, `HOLD_RELEASED` or `PREREQUISITE_CHANGED`'
c V33 $A11 "the application opens a **re-check dialogue**"
# V34 budgets
c V34 $A21 "The 80% warning shows in the thread and on the budget surface, not in Attention."
c V34 $A21 "one Attention item per budget (not per dialogue) lists the tasks held"
c V34 $A21 'Every further message charged to it is refused with `COORDINATION_BUDGET_EXHAUSTED`'
c V34 $A21 "**Reserve at its limit.**"
c V34 $A21 "The per-dialogue message limit still applies (:18, :43)."
# V35 linked pairs, detector
c V35 $A21 '`derived-from` is excluded.'
c V35 $A21 "A linked pair opens a dialogue without a user prompt"
c V35 $A21 "A deterministic coordinator detector runs on epoch activation (ADR 0011:129, :133), on an accepted map revision, and on a meaning-changing decision revision or retirement"
# V36 echoes, capture, host rule
c V36 $A22 'accepts only claims inside the proof'"'"'s changed paths'
c V36 $A22 "Location identity is a Compound code anchor"
c V36 $A22 'Pass 2:** the Run-absent read-only Project agent judges paraphrases over compiled context from the same capture'
c V36 $A22 "Memory and document work use the same **host rule**"
c V36 $A22 "a docs-update Waypoint the Supervisor proposes in a map revision"
n() { # id file string : must be ABSENT; an rg error (exit 2, e.g. a missing file) is a FAIL, never an absence
  rg -q -F -- "$3" $2; rc=$?
  if [ $rc -eq 1 ]; then echo "PASS $1 [$2] absent: $3"; elif [ $rc -eq 0 ]; then echo "FAIL $1 [$2] still present: $3"; fail=1; else echo "FAIL $1 [$2] rg error $rc: $3"; fail=1; fi
}
A19=docs/adr/0019-measured-evidence-result-limits-and-approval-authority.md
# Round-1 fixes K1-K20 (review-candidate-round1.md; decisions log §97)
c K1 $A11 ':22, :93, :134, :277, :287; ADR 0007:60, :81, :98'
c K1 $A07 '- :60, :81 and :98 ("only `ApproveRunAmendment`"'
c K2 $A19 '## Note (2026-10-16): amended by the #99 phase 2 amendment set (Accepted)'
c K2 $A19 'the union gains a sixth arm, `decision-search-capture-request`'
c K2 $A19 '- Status: Accepted; amended 2026-10-16 by note (Accepted)'
c K2 $A10 'the union gains a fourth arm, `decision-search-capture`'
c K2 $A10 'never advances `integration_target_current_evaluations`'
c K2 $A10 'The content Artifact is an `evidence-produced` Artifact'
c K2 $A10 'or by onboarding for Foundation inference'
c K2 $A15 '`RequestDecisionSearchCapture` and `RecordDecisionSearchCaptureOutcome`'
c K2 $P 'The content Artifact of a `decision-search-capture`'
c K2 $X 'Evidence owns its observation and immutable content Artifact'
n K2 $A21 'Integration-owned immutable content Artifact'
n K2 $A10 'It produces an Integration-owned immutable content Artifact'
n K2 $A06 'the `decision-search-capture` source and its content Artifact'
c K3 $A22 '"Begin update Run" row: a linked update Run exists for that host Waypoint, or the user chose "Skip this Waypoint"'
c K3 $A22 'update row: a `decision_follow_up_proposal_decisions` row records approve or decline'
c K3 $A22 'stale-memory and echo or candidate rows (information only): when the item resolves'
c K3 $A22 'search row: both passes are complete, or the user proceeds without search'
c K3 $A22 'Run row: the Run is terminal'
c K3 $A22 '| "Skip this Waypoint" (Begin update Run row) | "Undo skip"'
c K4 $A11 'a `paused` Run stays `paused`'
c K4 $A11 'the `ready | blocked` result of :133 and :217 and the `awaiting-approval -> ready | blocked` path of ADR 0007:34'
c K5 $A11 "| Waiting for the user's Begin of a change Run (completed proxy Waypoint) | kept; the change-Run proposal row offers \"Begin\" or \"Decline\" |"
c K5 $A11 '| The change Run begins (`PREREQUISITE_RUN_STARTED`) | carried into the two-Run joint set unchanged |'
c K5 $A11 '| The user declines the change-Run proposal | released (`released-on-change-run-declined`)'
c K5 $A11 'including a Contest hold on that Run (decisions log §97, K5)'
c K5 $A11 '| Decline a change-Run proposal |'
c K5 $A21 'The same bound applies when the Supervisor proxy itself is unavailable'
c K5 $A21 'releases a Contest hold with `released-on-run-end`'
n K6 $A13 '`process-execution`, `local-artifacts` mutation and `project-storage` are prohibited'
c K6 $A13 'This amendment sets no rule on `process-execution`'
c K6 $A13 'issues/136'
c K6 $A08 'issues/136'
c K6 $A21 'issues/136'
c K6 $X 'how its governed CLI session is launched is decided in issue #136'
c K6 $P 'how its governed CLI session is launched is decided in issue #136'
n K6 $A08 'has no Process job, no Run workspace and no CLI tools'
n K6 $A21 'It has no Process job, Run workspace or CLI tools.'
n K6 $X 'Run workspace, Process job, or mutation'
n K6 $P 'Worker, Process job, or mutation'
c K7 $A22 '- :48 ("nothing pauses or changes automatically"): a decision edit itself still pauses nothing.'
c K8 $P 'its row layout is provisional: see the label in ADR 0022 Amendment 1'
c K8 $P 'the two passes and their funding are provisional: see the label in ADR 0022 Amendment 1'
c K8 $P 'This joint-only scope is provisional: see the label in ADR 0011 Amendment 1.'
c K8 $P 'echo granularity and the recording moment are provisional: see the label in ADR 0022 Amendment 1'
c K8 $X 'joint-only scope, provisional: see the label in ADR 0011 Amendment 1'
c K8 $X 'Its granularity and recording moment are provisional: see the label in ADR 0022 Amendment 1.'
c K8 $X 'The two passes and their funding are provisional: see the label in ADR 0022 Amendment 1.'
c K8 $X 'Its row layout and resolution actions are provisional: see the label in ADR 0022 Amendment 1.'
c K8 $X 'the Evidence floor, provisional: see the label in ADR 0017 Amendment 1'
c K8 $A21 'The joint-only scope is provisional: see the label in ADR 0011 Amendment 1.'
c K8 $A21 'The decision-search entries of this table (not Foundation inference) are provisional'
c K9 $X 'it may have one Strand coordination budget, which Execution owns.'
c K10 $A11 '`SubmitRunAmendmentRequest` never creates it.'
c K10 $A11 'creates the narrowed `run-amendment` Control request for each non-`initial` component'
c K11 $A10 '`member_source_kind` gains `continuing-result`, with the typed child `candidate_delta_member_continuing_results`'
c K11 $A15 'The Candidate member gains the matching arm `candidate_delta_member_continuing_results`'
c K12 $P 'moves no Run that already had an epoch to another status'
n K12 $P 'moves no Run to another status'
c K13 $P 'Integration, or Run-absent invocation authority for its subject arm'
c K13 $X 'Artifact/Storage/Integration/Run-absent invocation owner state'
c K13 $A13 '**Indexes** (:298).'
c K14 $A21 'no need for a new decision'
c K14 $X 'and needs no new decision'
c K14 $A22 'or is information-only'
c K14 $P 'or are information only'
c K14 $X 'or is information only'
c K14 $A22 '`not-run(reason)`'
c K14 $X '`not-run(reason)`'
c K14 $A21 'exactly two user-visible release paths'
c K14 $X '(the two user-visible release paths), or when its Run ends'
c K14 $A13 '| `project-coordination` |'
c K14 $X '`integration`, or `project-coordination`'
c K14 $P '`integration`, or `project-coordination`'
c K15 $A21 'a two-arm union: `coordination-budget` (one coordination budget) for a phase 2 dialogue, or `run-budget`'
c K16 $A21 'A Contest hold has exactly two user-visible release paths'
c K17 $A10 'Retention: ADR 0018 applies unchanged (decisions log §98, L1).'
c K18 $A09 'Amendment 1 :288-289 (budget units)'
c K19 $A09 '(as ADR 0007:60 already does for pause and resume)'
n K19 $A09 'as ADR 0007:60 already does for availability'
c K19 $A09 'its conflict-scan request (`conflict-scan`) or its decision change event (`decision-follow-up`)'
c K19 $A13 'its conflict-scan request, its decision change event (decision follow-up turn)'
c K19 $A21 '`DIALOGUE_ADMISSION_BROKEN`'
c K19 $A21 '`COORDINATION_BUDGET_BROKEN`'
c K19 $A21 '`CONFLICT_DETECTOR_BROKEN`'
c K19 $X 'it becomes a joint proposal (one joint amendment set of per-Run components) that the user decides'
c K19 $A10 '- :401, :439 and :440 (Integration-target observation tables and source union'
c K19 $A19 '- :143 and :190 (three Integration-target capture sources)'
c K20 $A11 "for an \`initial\` component, \`RejectRunPreparation\`'s write set"
n K20 $A22 'and every diagnostic hold identities'
# Round-2 fixes L1-L14 (review-candidate-round2.md; decisions log §98)
c L1 $A10 'gives an `evidence-produced` Artifact the `durable-record` purpose'
c L1 $P 'is an Evidence-produced Artifact and, under ADR 0018 unchanged, a durable record'
n L1 $A10 'typed byte hold'
n L1 $A10 'retention purpose generated output'
n L1 $P 'generated-output retention'
n L1 $X 'generated-output retention'
c L2 $A10 '- :326, :384 and :415 (approved-limit bindings and their five typed owner children)'
c L2 $X 'Integration-approval, or decision-search-capture-request (ADR 0019 note) authority'
c L2 $A19 ':185 ("without adding a sixth direct Evidence-limit owner") and :190 ("Five direct owner arms")'
c L2 $A19 'ADR 0020:98'
c L3 $A11 '`DeclineChangeRunProposal` writes the user'"'"'s immutable decline in `change_run_proposal_decisions`'
c L3 $A11 'A `changed` set caused by a Decline opens **no** re-check dialogue'
c L3 $A11 '| Joint set goes `changed` (any cause except a Decline) |'
c L3 $A11 'for a Waypoint whose last Run ended `cancelled`, `failed` or `superseded` (ADR 0021 Amendment 1)'
c L3 $A21 'the same "Begin" or "Decline" row'
c L3 $A07 '`DeclineChangeRunProposal`'
c L4 $A22 'The decision owner'"'"'s idempotent `LinkDecisionFollowUpRun`'
c L4 $A06 '`decision_follow_up_proposals`, `decision_follow_up_proposal_decisions`, `decision_follow_up_run_links`'
c L4 $A22 'search row: both passes are complete, or the user proceeds without search'
c L4 $A22 'no search pass is `pending`'
c L4 $A22 '| "Undo skip" | "Skip this Waypoint" again'
c L5 $A11 'each narrowed `run-amendment` Control request and every contained Model-change request moves to `rejected`'
c L5 $A11 'contained Model-change requests to `superseded` (ADR 0007:81)'
c L5 $A11 'marks each narrowed `run-amendment` request applied'
n L6 $A11 'released only on technical re-agreement'
c L7 $A11 'it changes only the Run'"'"'s condition codes'
c L7 $A11 'a `blocked` Run that never started still reaches `ready` first and still needs `StartRun`'
c L7 $A07 '- :33-35 (lifecycle paths): joint approval changes no Run status.'
c L8 $X 'whose actions are the user'"'"'s Begin or Decline'
c L8 $X 'only a withdrawal returns the agreement to new seals'
c L8 $A21 'returns the agreement to new seals'
c L8 $A13 '**Effect Dossier** (:203)'
c L8 $X 'Run-absent invocation owner state'
n L8 $X 'whose only action is the user'"'"'s Begin'
c L9 $A21 'The decision-search entries of this table (not Foundation inference) are provisional'
n L9 $A21 'The decision-search and Foundation-inference rows are provisional'
if rg -q -U -F -- $'never `empty`.\n\n**Candidate member arm `continuing-result`**' $A10; then echo "PASS L10 [$A10] blank line before the continuing-result block"; else echo "FAIL L10 [$A10] blank line before the continuing-result block"; fail=1; fi
c L11 $A19 '**No headroom in v1** for this arm'
n L11 $A19 'headroom for this arm needs the exact user decision of :107'
c L12 $A06 'Evidence: the target observation, its `decision-search-capture` source child'
c L12 $A11 '"Nothing pauses automatically" still holds for the edit itself'
c L12 $A11 'for each non-`initial` component in its own transaction'
c L12 $A11 'the whole submission is rejected with `RUN_AMENDMENT_INCOMPATIBLE`'
c L12 $A10 'never moves its `latest_*` pointers'
for f in $A21 $A11 $A13 $A17 $A22; do n L14 $f '§90-§96'; done
for f in $A06 $A07 $A08 $A09 $A10 $A15 $A19; do n L14 $f '§90-§96'; n L14 $f '§90-§97'; done
n L14 $A21 'It has no Run workspace and no tools.'
c L14 $A09 '- :32 (provider-neutral cycle)'
# V25 acceptance half (K21 flip): Status suffixes, note Status lines, and no Proposed status left
A=docs/adr; for f in $A/00{06,07,08,09,10,15,19}-*.md; do c V25 $f "amended 2026-10-16 by note (Accepted)"; c V25 $f "Status: Accepted (2026-10-16). Source:"; done
for f in $A21 $A11 $A13 $A17 $A22; do c V25 $f "(see Amendment 1, Accepted)"; done
for f in $A/00{06,07,08,09,10,11,13,15,17,19,21,22}-*.md; do n V25 $f "(Proposed)"; n V25 $f "Status: Proposed"; n V25 $f "Amendment 1, Proposed"; done
exit $fail
```
