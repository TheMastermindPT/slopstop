---
date: 2026-10-16T17:36:22+0100
author: Pedro Mesquita
commit: dbb4132
branch: main
repository: slopstop
topic: "#99 phase 2 cross-Waypoint dialogue and decision-dependent staleness: the ADR amendments"
tags: [design, adr, agents, supervisor, forger, dialogue, runs, budget, decisions, memory, attention, issue-99]
lane: rigorous
lane_reasons: ["research lane rigorous: authority and approval boundaries (ADR 0010, ADR 0011, ADR 0013, ADR 0017, ADR 0021)", "lane.mjs over the amended documents: normal (files > 5); raise-only keeps rigorous"]
parent: .rpiv/artifacts/research/2026-10-16_17-01-10_cross-waypoint-dialogue-and-decision-staleness.md
issue: https://github.com/TheMastermindPT/slopstop/issues/99
status: in-review
last_updated: 2026-10-16T23:30:00+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Revision 3 (2026-10-16): applies every round-2 resolution Q1-Q22 (evidence .rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-2.md) and Pedro's round-2 answers (decisions log §95): ADR 0010 joins the set; Contest holds release only by re-agreement or withdrawal; a completed proxy Waypoint's Begin comes first, then a two-Run joint set; onboarding asks once for the Project reserve; the held-task time limit also covers waits on an unavailable Forger or a lapsed map link; acceptance of the slice candidate also accepts the amendments; the Portuguese copy. Closing path (A): no new agents; the coordinator checks each item against the 'Revision-2 round-2 resolution' table, then Pedro approves. Earlier: revision 2 applied R1-R30 and §94; revision 1 recorded §93; the first draft came from the #99 research (dbb4132) and §90-§92."
content_hash: 58167ac5c4d8dafaa2260a9c4deaf70820887c1d4df40539daa33efc083ce65d
---

# Design: #99 phase 2 cross-Waypoint dialogue and decision-dependent staleness

## Intent

**Outcome.** Pedro can approve, as accepted contracts, how parallel Waypoints agree with each other without discarding work or stopping unrelated work, and how a changed or retired decision stops outdated memories from reaching agents and lists everything that repeats it. This design fixes **what the ADRs must say**; it writes no ADR text and no code. Runs, the Supervisor and agent dialogue are not built (research, "Summary").

**Authoritative inputs**
- FRD `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md` (content_hash `7f749f754a8e82abbddbd3355e7f9b4621faced49ad3e93ac9f12083d04aaee5`): FR1-FR17, NFRs, acceptance criteria AC1-AC9 (FRD :94-102), Decisions, Open Questions.
- Research `.rpiv/artifacts/research/2026-10-16_17-01-10_cross-waypoint-dialogue-and-decision-staleness.md` (content_hash `0bf8366804a4a1ae6299891d7715db6081dae0ceddeb68caf1dbcb31a524c8b0`, committed in `dbb4132`).
- Decisions log `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md`: §90 (the FRD); §91 (Pedro is still unsure how memories and decisions work in practice, and chose to continue); §92 (research checkpoints **UD1-UD6**); §93 (design checkpoints **C1-C11**, **G11**, the undo rule **G15**); §94 (round-1 answers **R4, R8, R9, R10, R15, R17, R21**); §95 (round-2 answers **Q3, Q7, Q9, Q12, Q21**).
- Review evidence: round 1 `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-1.md` (R1-R30); round 2 `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-2.md` (Q1-Q22).
- The accepted contracts: ADRs 0006, 0007, 0008, 0009, 0010, 0011, 0013, 0015, 0017, 0020 (classification only), 0021, 0022; `PRODUCT.md`; `CONTEXT.md`; `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`.

**User decisions this design applies**
- **UD1-UD6 (§92).** (1) ADR 0021:45 and `PRODUCT.md:103` are amended: technical agreements inside the approved plans need no approval. (2) An agreement that changes a task contract or result schema (ADR 0011:84, :91), or contradicts an accepted decision, is always plan-changing. (3) While a joint proposal waits, only the affected tasks stop; on rejection they resume the prior plan. (4) One decision-change Attention item replaces ADR 0022:49's per-Run items, with one action per Run inside it. (5) "Wording only" also suppresses the per-Run notices; a scope-only or links-only edit is a real change. (6) Supervisor-opened dialogues and Project-scope decision searches are paid from a Project coordination reserve, approved once, warning at 80%.
- **C1-C11, G11, G15 (§93)**, **R4, R8, R9, R10, R15, R17, R21 (§94)** and **Q3, Q7, Q9, Q12, Q21 (§95)**: applied where cited and traced in the Traceability table.

**Non-goals**
- Editing any ADR, `PRODUCT.md` or `CONTEXT.md` now (a later build step writes the amendment text, after Pedro approves this design).
- Code, schemas, migrations or protocol changes (ADR 0006:62: no tables before first behaviour).
- Deciding where technical agreements are stored for future Runs (FRD Open Question 1, Pedro's open choice; G13).
- Direct Forger-to-Forger channels; agent messages with authority (ADR 0021:41, :44 kept).
- The FRD's suggested follow-ups (map change under a running Run; an Attention item for Run-to-Run conflicts; two Runs touching the same code).

**Constraints**
- Accepted ADR text is never rewritten: each change is a numbered "Amendment N" section with its own status, or a dated "Note (YYYY-MM-DD): amended by …" at the top naming the sections it changes (ADR 0009 Amendment 1 precedent; research "Composite Lessons").
- Every new Amendment section and note is written **Proposed** in the candidate; Pedro's acceptance of the slice candidate also accepts them, so the single commit carries **Accepted** status (Q12), recorded in the decisions log. `PRODUCT.md` and `CONTEXT.md` edits therefore land as current truth in that commit.
- New text uses Forger and Strand; "Waypoint parent" and "Feature" appear only in former-name notes.
- Every amended document changes in **one** commit, from **one** slice (R4, G14).
- `degrade-distinguishes-broken`: every new outcome keeps failed, truncated, not-run, pending and changed distinct from empty, clean or "none found".
- `shared-vocab-union`: one owner per new vocabulary (search outcomes: ADR 0022; the Run-absent invocation family and dialogue/budget codes: ADR 0021; the Effect subject arm: ADR 0013; the Evidence scope kind: ADR 0010; joint and hold codes: ADR 0011; the "decision" qualifiers).

## Architecture

### The shape in one paragraph
Everything that exists today is owned by one Run (epoch, proposal, Control request, budget, Invocation context, Model attempt, `run-worker` Effect). Phase 2 is the first thing that spans Runs. The design keeps Run-owned authority and adds only **non-authoritative links across Runs** (a Project-keyed dialogue record, a joint amendment set), **two new budget owners** (a Strand coordination budget and a Project coordination reserve), and **one Run-absent invocation family** with its own closed Effect subject (`project-coordination`) and Evidence scope kind for the Supervisor and the Run-absent read-only Project agent. Decisions gain a revision chain with a **meaning version**, which Memory binds to and which drives one change event, one decision-change Attention item and the echo search.

### A. Phase 2 dialogue (ADR 0021 Amendment 1)
- **Pair shape: one pair between two Waypoint sides** (G1). A side is that Waypoint's Forger when the Waypoint has a nonterminal Run; otherwise the Supervisor as **proxy** for that Waypoint (FR8). Admit, route, stop and hand-over are application-recorded thread events, not messages, so a dialogue keeps exactly two message authors (ADR 0021:17) and closes by the existing rule (:43). Rejected: two pairs through the Supervisor (no rule joins two closings into one A-B agreement; relaying loses attribution, :42).
- **What "through the Supervisor" means** (R25). ADR 0021:48 is **narrowed** by a dated note: Forgers of different Waypoints still never talk directly; the Supervisor coordinates by recording each dialogue's admission, routing every message (an application routing event per message) and acting as proxy for a side without a Run. A proxy dialogue (Forger with the Supervisor) is a phase 2 dialogue that is not between two Forgers.
- **Agreement class.** The closing envelope (ADR 0021:19, :42, noted) gains `agreement-class: technical | plan-changing`, declared by each side; if either says `plan-changing`, the result is `plan-changing` (bounds the FRD assumption at :90).
- **Application end reasons** (ADR 0021:43, noted). Besides the message limit and loop health, the application may end a dialogue `stopped` with a named reason: `counterpart-run-started`, `counterpart-run-ended`, `hold-time-limit-reached`, `budget-left-unchanged`. It never sets an agent's closing state (Q9).
- **Technical agreement** (FR5; UD1, UD2). `technical` only when all hold, otherwise `plan-changing`: no new, removed or changed task, dependency, order or fan-out; no change to any node-fingerprint input (ADR 0011:91); no changed Behavior, Test, Completion or Waypoint revision (ADR 0011:84); no added power (ADR 0011:174); no contradiction of a current accepted decision and no need for a new one (ADR 0022:21-22); doubt resolves to `plan-changing`. The technical-agreement entry records, for each involved Run, the exact accepted `DelegationTaskId`s its own Forger named as touched by the agreement, and that Run's epoch. **Until FRD Open Question 1 is answered (G13)**, the canonical writes are the dialogue messages, closing states and this immutable entry, and the agreement reaches agents only as agent-authored, no-authority context in **new** Sealed Invocations of the **involved Runs**, including their later epochs (Q11; a joint approval's classification carries it) (ADR 0021:44; ADR 0009:129; Amendment 1 :236). It never reaches other Runs (that is FRD Q1). No Attention item and no Decisions-page entry (FRD :79).
- **Contest** (C4; R9; Q2). Pedro's Contest is an immutable contest record linked to the entry (the entry is never edited; `contested` is derived from the latest contest record without a withdrawal record). It appends a human message (:47), places a task hold (B) on the entry's recorded tasks (each mapped to the current plan by id; a task no longer in the current plan is reported, never silently dropped), and the application opens a new dialogue in the same thread (same payer, D). A `contested` agreement stays out of new seals. The Contest hold has exactly two release paths: the new dialogue closes with a **technical** `agreement` (`released-on-technical-agreement`), or Pedro's **Withdraw contest** (`released-on-contest-withdrawn`; the agreement returns to new seals). A **plan-changing** re-agreement follows the joint-set rows of the hold lifecycle. A `no-agreement`, `needs-human` or `stopped` close keeps the hold and raises one Attention row whose only release control is "Withdraw contest". "Release held tasks" never applies to a Contest hold.
- **Linked pairs** (FR2). Linked = a current, non-archived `blocks` (either direction) or `related-to` relationship (ADR 0006:84-85); `derived-from` excluded. The admission record pins the relationship id and revision. Before each send the application re-checks it; if it is no longer current, the next message is held with `DIALOGUE_ADMISSION_CHANGED` until a recorded Supervisor re-admission or a stop; the wait is bounded by the held-task time limit (Q9). The word `changed` here is **dialogue-owned vocabulary** for a lapsed admission (it mirrors, but does not cite as authority, ADR 0011:183). Any other pair needs a recorded Supervisor admission, visible in the thread.
- **Hand-over.** If the proxy side's Waypoint gains a Run while a dialogue is **in progress** (slot vacant then occupied, ADR 0007:31-32), the proxy dialogue ends `stopped` (`counterpart-run-started`) and a new dialogue with that Forger opens in the same thread, with the prior messages as agent-authored context; the mirror case (`counterpart-run-ended`) opens a proxy dialogue. A hand-over dialogue keeps the original payer, and holds carry over unchanged. This rule applies only to dialogues in progress; a submitted joint set follows B.
- **Ownership.** The dialogue family (ADR 0021:80) becomes **Execution-owned and Project-keyed** `(project_id, dialogue_id)`, with typed participant arms (`forger`: run and parent; `supervisor-proxy`: Waypoint and the Waypoint revision answered for), an immutable **admission child** (`map-link`, `supervisor-admission`; for phase 1 also `declared-pair` and `forger-admission`, closing the missing phase 1 record), a **payer child** (a coordination budget), per-message routing events, and immutable contest and withdrawal records. Every involved Run overview shows the thread; a proxy side shows it in the Strand view. It is not a Board entry (`PRODUCT.md:56`).
- **"No active Run"** = the Waypoint's Run slot is vacant (ADR 0007:31-32). Any nonterminal Run, in any of its states (ADR 0007:32), is answered by its own Forger; if that Forger is unavailable the dialogue waits visibly, bounded by the held-task time limit (Q9).
- **Waypoint without a Run** (FR8). The proxy answers from canonical records only (C). A needed change becomes:
  - for a **completed** Waypoint (Q3): a typed change-Run proposal whose action is Pedro's `BeginAction` with cause `ACTION_SELECTED` (ADR 0011:125; ADR 0007:43 unchanged; the dialogue is provenance, not a cause); once that Run's Forger exists, the agreement **re-enters as a two-Run joint set** with that Forger, and the one-Run set (if any) closes with the named cause `PREREQUISITE_RUN_STARTED` (a closing, not `changed`). If that Waypoint's Candidate is still awaiting review, the action is Pedro's Request changes instead (ADR 0015:83);
  - for a Waypoint whose last Run ended `cancelled`, `failed` or `superseded`: a `BeginAction` proposal (same re-entry as above), or a map, decision or contract revision proposal;
  - for a **not-started** Waypoint: a map, decision or contract revision proposal (ADR 0021:34, noted for proxy and follow-up map revisions: Pedro's approval of the typed proposal is the "yes", no Frame needed; ADR 0022:28; ADR 0012:149), anchored to exact revision ids.
  The Supervisor starts nothing (ADR 0021:34, :91; `PRODUCT.md:105`).
- **Proxy-side agreements use the joint path** (R21). A plan-changing agreement between a Run side and a proxy side becomes a joint amendment set with N = 1 while the proxy's change is a **revision proposal**, so only the affected tasks stop (B). That revision proposal is a **prerequisite that must settle before the joint approval** (R3): a sealed `pending` proposal condition of the joint set (accepted, or `PREREQUISITE_CHANGED` if rejected or superseded), never a task edge or task input; ADR 0011:203, :249 and ADR 0015:37 stay unchanged. A change that needs a Run on the proxy side follows the Q3 sequence above instead.
- **Supervisor-detected conflicts** (FR3). A deterministic coordinator detector runs on epoch activation (ADR 0011:129, :133), an accepted map revision and a **meaning-changing** decision revision or retirement (the change event in E; never a wording-only revision), comparing across nonterminal Runs: effect scopes (ADR 0011:234), typed resource keys (`PRODUCT.md:111`), contract-clause links (ADR 0011:91), decision implementing links (ADR 0022:22) and map relationships. A candidate triggers one Supervisor `conflict-scan` turn (Project reserve, UD6) that decides whether to open a dialogue. "Not checked" and "check failed" stay distinct from "no conflict" (ADR 0022:50). Lease-time collisions (`PRODUCT.md:110`) and in-plan independence (ADR 0011:103) are unchanged.

### B. Joint proposal and the affected-task hold (ADR 0011 Amendment 1)
- **Joint amendment set** (FR6). For N ≥ 1 covered Runs: N per-Run proposals (ADR 0011:25, :246) plus one immutable **joint amendment set** with **no authority**: member proposal ids and their manifest, view and classification hashes, each covered Run's bound epoch, the sealed prerequisite conditions (A), a set hash and one composed joint view. Decisions stay per proposal (:247). Precedent: the Approval Dependency Graph (ADR 0011:26). Rejected: a joint approval aggregate (ADR 0011:28). The set appears as **exactly one** Attention item.
- **A joint component is an amendment proposal with a narrowed request** (R13). Each component carries the exact compatible `run-amendment` Control request ADR 0011:54 requires, but for joint components that request closes dispatch **only for held tasks** and does not move the Run to `amendment-requested`. Notes name every replaced sentence: ADR 0011:54, :127, :130, :131, :133, :165, :215; ADR 0007:34; `PRODUCT.md:105`, :129. Single-Run amendments keep all of them unchanged (C5).
- **Source states** (Q13). A joint component may be sealed only from `running`, `paused`, `blocked` or `ready`, or `awaiting-approval` for an `initial` component; any other state is refused (`JOINT_COMPONENT_STATE_INVALID`).
- **Commands.** `SubmitJointRunAmendment` **alone** seals all components (reusing `SubmitRunPreparation`'s validation rules without its state transition) and the set, in one Writer transaction (Q13); `ApproveJointRunAmendment` and `RejectJointRunAmendment` decide the whole set; `SettleJointRunAmendmentChanged` writes durable `superseded` decisions on siblings after the set became unapprovable. Each is a specific command with a declared complete write set (ADR 0007:50); the generic batch stays prohibited. All Runs of a Project share one `slopstop.db` and one Writer fence (ADR 0006:41-47, :71). **One receipt** carries N decisions and N epochs (ADR 0006:66-69 allows several events on one receipt); notes clarify ADR 0011's receipt wording (:37, :38, :60, :224, :248).
- **"Only X creates or approves" sentences** get joint notes: `PRODUCT.md:107`, `CONTEXT.md:66`, ADR 0007:81, ADR 0009:124, :183, ADR 0011:22, :93.
- **Compare-and-set over all N Runs** (ADR 0011:133, :223-225): everything the single-Run check verifies, plus the set hash and cardinality, each member being its Run's current non-superseded pending proposal, each covered epoch equal to the bound epoch, no covered Run terminal or `recovery-required`, every prerequisite settled, every hold current. Any failure rejects the whole command before authority changes; Approve and Reject always decide all N components.
- **Unapprovable state = `changed`** (FR7). `stale` is reserved for accepted authority (ADR 0011:183-184). The set becomes unapprovable immediately by derivation (precedent ADR 0017:89) with a closed cause: `EPOCH_MOVED`, `RUN_ENDED`, `COMPONENT_SUPERSEDED`, `RUN_RECOVERY_REQUIRED`, `HOLD_RELEASED`, `PREREQUISITE_CHANGED`. Product copy: "out of date" in English, **"proposta ultrapassada"** in Portuguese (Q21), distinct from the held-task limit **"tempo de espera esgotado"** and from memory **"desatualizada"**; `CONTEXT.md` maps the copy to the states. A covered Run's own terminal transaction writes `superseded` on its own component (amends ADR 0007:36); single-Run approve and reject refuse a joint component (`JOINT_COMPONENT_REQUIRES_JOINT_DECISION`). A per-Run "Ask the Forger for an amendment proposal" row (F) on a Run with a pending joint component routes into the joint re-check and warns before superseding.
- **When a set goes `changed`**, the application opens a **re-check dialogue** in the same thread (same payer); the Forgers re-check and propose again (FR7).
- **Epochless members.** A covered Run still awaiting its initial approval may join as an `initial` component bound to "no epoch" plus its exact pending proposal; the joint approval performs `ApproveRunPreparation`'s write set (ADR 0011:214) for it, including the C1 budget lines when applicable (D). An `initial` component's Run ends `ready` or `blocked` (ADR 0011:214) and still needs Start: C7 ("continue on their own") applies to Runs that already had an epoch. A `draft` Run with no sealed proposal blocks submission (`JOINT_AMENDMENT_COMPONENT_MISSING`).
- **Task hold** (FR4, UD3). A new Run-targeted Control-request kind `task-hold` with a typed child listing exact accepted `DelegationTaskId`s of the current plan (ADR 0011:93, :242, :257), validated by composite foreign key; target shapes stay unchanged (ADR 0007:77). Every hold has an attributed source: a **typed Forger hold proposal** that the deterministic coordinator validates against the current plan and admits as a narrowing (precedent ADR 0011:96, :173, :175; ADR 0007:51), or a **user action** (Contest, Hold again). Message text never places a hold. Each Run's own Forger names its own affected tasks (ADR 0021:36); until Run B's Forger names them, Run B keeps running and the thread shows that gap. The application adds every DAG descendant as explicit child rows with reason `named` or `descendant-of` (not a transitive index, ADR 0011:265). Affected tasks that already succeeded are labelled "affected (completed)" and keep their result unless the component classifies it `invalidated` (ADR 0011:146, :148).
- **Hold commands**: `RequestTaskHold` (Forger proposal admitted by the coordinator, or user), `ConfirmWorkerHeld`, `ReleaseTaskHold` (user, or the lifecycle below), `ResumeHeldWorker`; each with a declared write set, listed in the ADR 0007:47 note.
- **Held in-flight Workers** are Worker `paused`, keeping identity and slot (ADR 0007:56, :59-60), with ADR 0008:74's stop-checkpoint proof minus terminal stop. In CLI mode the session ends (Amendment 1 :280); continuation is a new stateless session under a new seal (:272; ADR 0009:129); in-progress reasoning is lost (:323). A dated note on Amendment 1 :279 and :323 states that, **for task holds only**, the continuation keeps the same Worker identity (as ADR 0007:60 already does for availability).
- **Held-task time limit** (R10, Q9). One elapsed-time limit (number open) bounds every hold that waits on others: a `changed` set's re-check, a dialogue waiting on an unavailable Forger, and a dialogue whose admission lapsed. At expiry the application ends the open dialogue `stopped` (`hold-time-limit-reached`), raises one Attention row (`TASK_HOLD_TIME_LIMIT_REACHED`, copy "tempo de espera esgotado") with "Release held tasks", and never sets an agent's closing state. Contest holds are not time-limited (R9).
- **Hold lifecycle** (one release reason per end):

  | How the dialogue or proposal ends | Hold |
  |---|---|
  | Technical agreement (FR5) | released (`released-on-technical-agreement`) |
  | Plan-changing agreement → joint set submitted | kept until the set is decided |
  | Joint approval | consumed (`consumed-on-approval`) |
  | Joint rejection | released (`released-on-rejection`); prior plan resumes |
  | Joint set goes `changed` (C6) | kept while the re-check dialogue runs, until the time limit; then stopped and one Attention row |
  | Waiting on an unavailable Forger, or a lapsed admission (Q9) | kept until the time limit; then stopped and one Attention row |
  | `no-agreement`, `needs-human`, `stopped` (message limit, loop health, Pedro's stop) | kept; one Attention row with "Release held tasks" |
  | Coordination budget exhausted | kept; the budget's Attention item lists the held tasks; "Leave unchanged" ends the paid dialogues `stopped` (`budget-left-unchanged`), which gives the previous row |
  | Hand-over (`counterpart-run-started` / `-ended`) | carried to the new dialogue unchanged |
  | Contest hold | released only on technical re-agreement or Pedro's "Withdraw contest" (R9); plan-changing re-agreement follows the joint-set rows |
  | Pedro's "Release held tasks" (every row above **except** Contest holds) | released (`released-by-user`); a pending joint set becomes `changed` with `HOLD_RELEASED` |
  | A covered Run ends | that Run's holds released (`released-on-run-end`) |

- **Unaffected work keeps running while the joint proposal waits** (UD3). A joint component classifies each unaffected task `unaffected-continuing` (task id and fingerprint, with no edge into an affected task); its Workers, results and effects stay governed by their own lifecycle under the source epoch, and its accepted results carry to the successor epoch by that sealed rule (declared, not inferred, ADR 0011:164). After joint approval, a continuing Worker's **later seals pin the successor epoch** with that declared carry (ADR 0009:39 note); a result it produced under the source epoch enters a Candidate through a new member arm `continuing-result` (ADR 0015:150-151 note). Notes name the complete-classification sentences: ADR 0011:35, :54, :140, :152, :166, :168, :223, :250, :288; ADR 0015:48, :133, :148, :150-151; `PRODUCT.md:105`; `CONTEXT.md:60`. A Run-wide change in a component (profile, workspace, discipline, Run-level limit) makes every nonterminal task affected.
- **Run status.** No new status and no new Run cause (ADR 0007:32, :43 untouched). A covered Run that already has an epoch keeps its state with a pending component (ADR 0007:40); "all remaining tasks held" is a derived label and condition, never a status.
- **Rejection** writes N `rejected` decisions, releases every hold, and held Workers resume as the same identity under a fresh seal on the prior epoch — replacing, for joint components only, ADR 0011:128's "dispatch stays closed". **Approval** activates one epoch per Run under one receipt, consumes the holds, and Runs that already had an epoch continue without a separate Start (C7).
- **Scope of the narrower closure** (C5): joint components only (including N = 1, R21), labelled provisional (G12). Single-Run amendments, including those from a phase 1 dialogue, keep ADR 0011:131's whole-Run closure, as ADR 0021:58 kept it.
- **Diagnostics** (ADR 0011 Amendment owns): `JOINT_AMENDMENT_CHANGED` (with the closed causes), `JOINT_AMENDMENT_INCOMPLETE`, `JOINT_AMENDMENT_COMPONENT_MISSING`, `JOINT_COMPONENT_REQUIRES_JOINT_DECISION`, `JOINT_COMPONENT_STATE_INVALID`, `JOINT_AMENDMENT_BROKEN`, `PREREQUISITE_RUN_STARTED`, `TASK_HOLD_ACTIVE`, `TASK_HOLD_TARGET_INVALID`, `TASK_HOLD_TIME_LIMIT_REACHED`, `WORKER_HOLD_CHECKPOINT_PENDING`, `TASK_HOLD_BROKEN`. ADR 0021 owns `DIALOGUE_ADMISSION_CHANGED`, `COORDINATION_BUDGET_EXHAUSTED`, `COORDINATION_BUDGET_MISSING` and `COORDINATION_BUDGET_PROPOSAL_CHANGED`; ADR 0011 only references them. A broken hold evaluation never reads as "no tasks held".

### C. Run-absent invocations: the Supervisor and the Project agent (ADR 0009, ADR 0010, ADR 0013, ADR 0007 notes)
- One **Run-absent invocation family** with two typed arms (G4; one owner, `shared-vocab-union`):
  - `supervisor-coordination`: purposes `dialogue-turn | proxy-answer | admission | conflict-scan | decision-follow-up`;
  - `project-agent`: the **Run-absent read-only Project agent** (R17), purposes `foundation-inference | decision-echo-search` (Q5), for Foundation inference (replacing "a read-only Worker" at ADR 0022:43) and the decision echo search (FR14). It is not a Worker: no Worker slot, status or Delegation task (ADR 0007:25 unchanged). ADR 0021:35 and :37 get only a clarifying note: reviewer and reader Workers inside Runs are unchanged.
- **The Project agent has no tools** (Q6). It reads only **compiled context** (`no-workspace-input`, ADR 0009:40): the deterministic pass-1 observer (F) builds that context from an Integration-owned immutable content Artifact bound to one Integration-target fingerprint captured by a new, named capture source `decision-search-capture` (dated notes on ADR 0010:220 — which today lets only `TARGET_FINGERPRINT_CAPTURED` own a fingerprint identity —, ADR 0015:91 and ADR 0006). It has no Process job, no Run workspace and no CLI tools, so ADR 0008:34, :52 and Amendment 1 :243, :252-256 stay unchanged; its retention follows the Artifact rules (ADR 0018).
- **Effect subject** (R1, Q1, Q5). ADR 0013 gains, by an Amendment that explicitly lifts its "no fourth variant" rule (ADR 0013:29; also :268, :344) for this one arm, a closed `EffectSubjectKind` arm `project-coordination`: exact Project, exact Run-absent invocation identity (arm and purpose), exact coordination budget, one Evidence scope of the new closed kind `project-coordination`, and for `project-agent` the captured content Artifact as read-only input; explicitly absent: Run, Forger, Worker, Delegation task, Run-workspace, Process job and mutation. Ownership follows ADR 0013:19: the **Application coordinator** owns identity and declaration; **Execution** is the subject owner (lifecycle, owner observations, retry authority and the broken or missing outcome); **Evidence** owns the Recovery Journal, reconciliation and current authority. The Amendment defines the arm's retry-authority child (ADR 0013:182, :292), its `slopstop.db` partition and subject tables (ADR 0013:234, :239-241) and its gate consumer. A Run-absent turn that observes `provider-unavailable` or `model-unavailable` records the matching Run-absent outcome (dated note on ADR 0009:97-98). Each arm's turn sequence is owned by its dialogue (`supervisor-coordination`) or its search or inference request (`project-agent`) (ADR 0009:30).
- **Evidence scope kind** (Q1). ADR 0010 is amended by a dated note: the closed scope kinds (ADR 0010:409) gain `project-coordination`, with a one-to-one child `project_coordination_evidence_scopes` in the typed-scope family (:386), binding one exact coordination invocation; like `project-operation` it has no invented state fingerprint (:276, :410); the stable-identity rule (:275) and the Recovery Journal key (:433) apply unchanged. ADR 0013:13 is named as unaffected (mutation-lease owners). ADR 0020:47 and :89 are classified unaffected (Run-scoped `sealed-invocation`; subject ordering covers only arms that reach convergence).
- It extends the Sealed Invocation target union (ADR 0009:38, Run explicitly absent), the Invocation context record (:49) and `CONTEXT.md:63` (no policy epoch for this arm), the Model attempt owner (ADR 0007:27, :69), the Turn Machine sequence and loop health (ADR 0009:23, :30-31, :102), attribution sentences (ADR 0009:53, :72, :122, :175, :178; ADR 0006:102; `PRODUCT.md:85-86`; `CONTEXT.md:37`, :62, :68), the Effect subject and scope sentences (`CONTEXT.md:71-73`, :123-124; `PRODUCT.md:111`; ADR 0006 effect families), and the role table (Amendment 1 :224-228: a Supervisor row and a Project-agent row, both a governed CLI session with no tools like Conversation, :228, :272; the billing mode is pinned per turn because there is no Run, refining :221).
- **Supervisor context** (source-selection rule, recorded per ADR 0009:50, :58): canonical records only — map, the involved Waypoint and Strand revisions and relationships; every Foundation section (ADR 0022:42) plus decisions scoped to or implemented by the involved Waypoints; accepted contract revisions; each involved Run's accepted plan, fingerprints, effect scopes and approval view; for a completed side, Candidate review, Completion authorization, Integration proof and decision trailers; dialogue messages as agent-authored. Repository content and Project conversation messages are excluded with a recorded reason. The Supervisor never reads code (ADR 0021:34-35).
- Forger turns in a cross-Waypoint dialogue keep the Forger target with purpose `cross-waypoint-dialogue`; their budget scope is the dialogue's payer; they stay `run-worker` Effects of their own Run.

### D. Coordination budgets (ADR 0021 Amendment 1; ADR 0006 and ADR 0011 notes)
- **Owner.** An Execution-owned **coordination budget** with scope union `strand` (Strand id) or `project-reserve`, immutable approved revisions (limits, approval decision, receipt) and a current waterline (consumed, pending) with a warning state. A raise needs a new approved revision; a lower limit applies at once (ADR 0011:173-174 analogues). Defaults come from the Project profile (ADR 0021:84; ADR 0006:52). It replaces the single "Supervisor coordination budget" of ADR 0021:53 and the rationale at :92 (both noted). Rejected: a Strand revision child and the profile as authority.
- **Approval moment** (C1, Q7, Q8). A Strand's budget is a **sealed, separately hashed input** of the first Run approval proposal of any Waypoint in that Strand; it appears in the view, and rejecting it rejects that approval (notes on ADR 0011:44, :55, :74-76, :129, :214). The Project reserve is approved either by that same route in the Project's first Run approval, or **earlier** through a one-time Attention ask (`ApproveCoordinationReserve`, own receipt) raised the first time a reserve-paid turn is needed — always at onboarding for Foundation inference (Q7). A Run approval carries the reserve line **only while no approved reserve revision exists**. One pending budget proposal per Strand (and one for the reserve) with compare-and-set: if two first approvals race, the loser's budget line becomes `changed` (`COORDINATION_BUDGET_PROPOSAL_CHANGED`). An `initial` joint component carries these lines when applicable.
- **Who pays** (FR9, FR10, UD6, R15, Q10):

  | Turn | Payer |
  |---|---|
  | Forger-requested dialogue (every message, proxy answers, admission turns) | the requesting Strand, pinned at open; the Project reserve while that Strand has no budget yet |
  | Hand-over, Contest and re-check dialogues | the original dialogue's payer |
  | Supervisor-opened dialogue; conflict scan | Project reserve |
  | Project-scope decision search; Foundation inference | Project reserve |
  | Waypoint- or Strand-scope decision search | that Strand's budget, or the Project reserve while that Strand has none yet (R15) |
  | Decision follow-up proposal turn | the payer of its decision's search |

  When the reserve itself does not exist yet, the turn is `not-run(budget-missing)` (`COORDINATION_BUDGET_MISSING`) and the one-time Attention ask applies. Cross-Waypoint Forger turns never debit a Run (makes ADR 0021:53 explicit; amends `CONTEXT.md:35`). In-Run dialogue stays under ADR 0021:52.
- **Debit.** Turns pin budget scope and a reservation (ADR 0009:43, :108); validated usage debits that waterline; missing usage is pending, never zero (ADR 0009:101).
- **Units.** Tokens, turns, elapsed time and messages for every mode; plan utilization for subscription-mode turns (Amendment 1 :288); a money ceiling for API-mode turns (:289). One budget may mix modes.
- **Warning and limit.** The 80% warning shows in the thread and on the budget surface, not in Attention (Attention holds only actionable items, `PRODUCT.md:48`). At the limit: one Attention item per budget (not per dialogue) listing the tasks held by the dialogues it pays for, with "Approve a raise" or "Leave unchanged"; every further message charged to it is refused (`COORDINATION_BUDGET_EXHAUSTED`); the per-dialogue message limit still applies (ADR 0021:18, :43). The reserve behaves the same: no new Supervisor-opened dialogue, conflict scan, Project-scope search, Foundation inference or reserve-paid turn runs until Pedro decides (C3).
- **Numbers** stay open (FRD Open Question 3; ADR 0009:163): the defaults table (ADR 0021:65-76) gains rows "Strand coordination budget", "Project coordination reserve" and "Held-task time limit", marked open.

### E. Decision revisions as mandatory memory dependencies (ADR 0017 Amendment 1)
- **Naming fix** (`shared-vocab-union`). In ADR 0017 "accepted decision" means an **Evidence decision** (ADR 0017:33, :47, :88). New text says **accepted decision revision** for product and plan decisions (ADR 0022:15, :21). `PRODUCT.md:64` and `CONTEXT.md:167`, :170 become: a memory is effectively stale as soon as "any exact Evidence decision stops being current, or a bound decision's meaning version changes or the decision is retired" (Q15) — never tied to the decision's current pointer.
- **Dependency arm** (FR11). One more typed child of the existing single set (ADR 0017:47-48, :138): `memory_revision_mandatory_decision_dependencies`, binding Project, decision id, exact revision id, the revision's **meaning version** and its digest. Rejected: a parallel set (breaks "one set", :47) and modelling decisions as Evidence (breaks ownership, :19). The amendment names every Evidence-only sentence it changes: ADR 0017:9, :20, :47, :53, :59, :60, :63, :86, :87, :113, :129 (`memory_revision_evidence_dependency_sets`), :138, :144, :157, :171, :172; :157 and :171 ("any mandatory dependency replacement stales") get the meaning-version exception for decision members.
- **Evidence floor** (provisional, G12). Every set keeps at least one Evidence member; decision members are extras. A memory resting only on a decision would be a copy of it, which `PRODUCT.md:64`, ADR 0022:44 and the FRD Non-Goal :55 forbid.
- **Event** (FR12, FR17). The decision owner emits a new Canonical event `decision-current-meaning-replaced` v1 in the same transaction as every meaning-changing revision and every retirement (ADR 0006:69), with a typed child (decision, prior and replacement revision and meaning version, kind `replaced | retired`, cause `mandatory-decision-no-longer-current`). No event for a first revision or a wording-only revision (mirrors ADR 0017:41). The decision owner never queries Memory (mirrors :19); Memory never moves a decision pointer. Settlement takes a closed two-arm event union (still typed, :119); settlement stays keyed by event (:140); both event types order by `(project_sequence, event_ordinal)` (:66); the reverse index (:52) gains a decision arm. Rejected: reusing the Evidence event (wrong owner and aggregate, :19, :26, :28) and a sweep (forbidden global cursor, :144).
- **Trusted read.** A separate decision step after step 5 (ADR 0017:87-88): the current revision is not a retirement, its meaning version equals the bound one, and the bound digest verifies; otherwise the revision is effectively `stale` (:89); an unreadable decision row returns `failed`, never empty or trusted (:96). ADR 0017:88's exact equality is amended **for the decision arm only**.
- **Acceptance recheck** (:49) also requires every decision member to be the exact current, non-retired revision; any concurrent decision revision, even wording-only, rejects acceptance.
- Stale stays immediate and terminal (:60-63); re-verification still creates a new revision (:13, :61).

### F. Decision retirement, wording-only revisions, echoes and the single change item (ADR 0022 Amendment 1)
- **Retirement** = a new Accepted retirement revision with **no in-force content**, and the current pointer advances to it; the current row's archive state is denormalised from it (ADR 0006:33). A retired decision has a current row but no in-force revision: context selection excludes it with reason `retired` (ADR 0022:34-35); pinned Runs keep their pin (:36, :48); bound memories are stale. Restore creates a successor revision from earlier content (ADR 0006:36) and always increments the meaning version. Rejected: archive-state-only retirement (a pointer comparison would pass silently).
- **Meaning version and "wording only"** (FR16, UD5). Each revision stores a `meaning_version` that increments on every revision except one Pedro marks wording-only; that revision keeps its predecessor's meaning version and records an immutable, user-attributed `wording-only-of` link (precedent: reuse links, ADR 0006:90 — computed there, user-asserted here). The mark is refused (`DECISION_WORDING_ONLY_NOT_APPLICABLE`) when the predecessor is retired or the scope (ADR 0022:21) or implementing set (:22) differs in any way; retirement and restoration never carry it; only Pedro's direct edit on the Decisions page can set it (no field in Supervisor proposals, Decision checkpoints, follow-up proposals or agent messages, ADR 0022:28, :54). Effects of the mark: no event, no memory staleness, no document flag, no search, no per-Run notice (UD5); the mark stays in the decision history. Correcting a mistaken mark (C11): "Mark as meaning changed" creates a new unmarked revision with the same text and runs the full change path.
- **Echo record** (FR13). Recorded at the **Integration application proof** — the only point where text reaches the user's working tree (ADR 0015:97; `PRODUCT.md:123`; `CONTEXT.md:183`). A doer Worker's result declares attributed, untrusted echo claims (decision revision plus location) (ADR 0015:48, :50); composition carries them into the Candidate manifest (:62); after an `applied` proof, an idempotent `RecordDecisionEchoes` keyed by proof id and claim position accepts only claims inside the proof's changed paths. Integration never writes decision state. Commit trailers (ADR 0022:60) stay as the commit-level complement. Location identity is a Compound code anchor (`CONTEXT.md:160`) on the `integration-target` Evidence scope (`CONTEXT.md:123`, :179), never a path (ADR 0015:21; `CONTEXT.md:158`); states `current | moved | missing | anchor-unresolved` (a failed anchor keeps the echo at document granularity, never drops it). Rows hold ids, hashes and the anchor — no decision text, excerpt or path in events or diagnostics (ADR 0006:116; ADR 0017:39, :100; `PRODUCT.md:116`). Echoes are navigation only; they grant no trust.
- **Change-time search** (FR14; R17; Q6). Pass 1: a deterministic owner-specific observer (`PRODUCT.md:100`, :122) does a literal and identifier scan of the `decision-search-capture` content Artifact (C), at no model cost. Pass 2: the Run-absent read-only Project agent (C) judges paraphrases over compiled context from the same capture, paid per D. FR14's "read-only Worker" is refined to this agent (§94, R17). **ADR 0022 Amendment 1 owns** the decision-search outcome vocabulary, mirroring (not extending) ADR 0017:96 (Q14): `pending | complete | empty | truncated | failed | not-run(reason)`; `empty` requires a complete scan; nothing but `empty` may display as "no documents found" (ADR 0022:50). No stored full-text index (ADR 0006:137).
- **The single decision-change item** (FR15, UD4, G11). A direct projection, not a stored status (ADR 0017:101-102): one item per decision, keyed by decision id over its unresolved change events; repeated changes fold into one item targeting the current meaning version. **Definition:** a row holds exactly one decision point, with its listed alternatives; information-only rows are allowed. Rows:
  - one per pinned nonterminal Run whose epoch pins an older meaning version — alternatives "Ask the Forger for an amendment proposal" (ADR 0022:49's action, now per Run) or "Keep the earlier version for this Run" (C9);
  - stale memories (information only, linking to the library; Memory proposals still never create Attention, `PRODUCT.md:64`);
  - echoes and search candidates with each pass's outcome (information only); a search row with alternatives "Retry search" or "Proceed without search" while a pass is `failed` or `not-run`;
  - one row for the Supervisor's proposed update — alternatives approve or decline;
  - one "Begin update Run" row per host Waypoint after approval.
  Row answers are owned by the decision owner in `decision_change_row_answers` (keep, undo keep, proceed without search, retry), and a row resolves when: the Run is terminal, its epoch pins the current meaning version, or Pedro kept the earlier version (Run rows); the update is approved or declined (update row); a pass completes or Pedro proceeds without search (search row). No item when the change has no dependants and both passes are complete-empty; "checking" while pending; a load failure never shows as an empty list (`PRODUCT.md:48`). The rail counts items, not rows. The J3 refinement ("one exact action per row") is recorded in decisions log §93 (G11).
- **Update work** (FR15). The Supervisor's output is a typed **decision follow-up proposal** (a new kind under ADR 0021:45) in three groups: pinned Runs use the per-Run amendment path; **memory re-verification** is proposed as a `memory-propose` reader task in an update Run, and each resulting Memory Proposal still needs Pedro's acceptance (`CONTEXT.md:169`; ADR 0017:135); document updates need doer Workers in a Run (`PRODUCT.md:100`). Both memory and document work use the same host rule (Q19): an existing host Waypoint (implementing Waypoints first, then the scope Waypoint) through Pedro's `BeginAction` (`ACTION_SELECTED`), or, with no host (always for a Project-scope decision), a docs-update Waypoint the Supervisor proposes in a map revision, in the scope Strand or one Pedro picks (C10). Pedro acts at every authority step (map acceptance, Begin, Run approval).

### Data flow
```text
Forger A asks / detector flags (meaning changes only) --> Supervisor admission (map-link | supervisor-admission) --> dialogue (side A <-> side B | proxy)
  --> affected tasks named by each Run's Forger (typed hold proposal, admitted) --> task-hold per Run (affected + descendants paused; others continue)
  --> close: technical  --> thread entry (+ tasks, epoch), context in new seals of the involved Runs, holds released
          plan-changing --> SubmitJointRunAmendment (N >= 1 components + set + sealed prerequisite conditions, settled before approval) --> one Attention item
                            --> Approve: N epochs, one receipt, holds consumed | Reject: N rejected, holds released, prior plan
                            --> epoch moved / Run ended / hold released / prerequisite changed: set `changed` --> re-check dialogue (time-limited)
          proxy Waypoint needs a Run --> Pedro's Begin --> agreement re-enters as a two-Run joint set (one-Run set closed: PREREQUISITE_RUN_STARTED)
decision edit (meaning change) or retire --> decision-current-meaning-replaced event
  --> Memory: bound revisions effectively stale at read, settled later
  --> decision-search-capture --> pass 1 (observer) + pass 2 (Project agent, compiled context) --> one decision-change item (one decision point per row)
wording-only edit --> same meaning version --> nothing downstream
```

## Decisions

- **G1 Dialogue shape.** One pair between two Waypoint sides; the Supervisor admits, routes and proxies; `agreement-class` with a conservative join; named application end reasons. ADR 0021:48 narrowed by note.
- **G2 Technical agreement** (FR5; UD1, UD2). The five bounds; doubt is plan-changing; the entry records tasks and epochs; effect only in new seals of the involved Runs (across their later epochs), until FRD Q1 is answered; no Attention or Decisions entry. ADR 0021:44 stays literally true.
- **G3 Linked pairs and admission.** `blocks` either way or `related-to`, pinned and re-checked per send (`DIALOGUE_ADMISSION_CHANGED`, dialogue-owned `changed`, time-limited); other pairs need a recorded Supervisor admission; hand-over (dialogues in progress only) keeps payer and holds.
- **G4 Run-absent invocation family** with arms `supervisor-coordination` and `project-agent` (the Run-absent read-only Project agent, no tools, compiled context only), its ADR 0013 Effect subject `project-coordination` (Execution subject owner) and its ADR 0010 Evidence scope kind. Rejected: Conversation turns (ADR 0009:48; ADR 0021:26, :47) and hosting in the requesting Run (ADR 0021:53, :92).
- **G5 Coordination budgets.** Strand budget and Project reserve as Execution-owned budget records; sealed budget lines in first Run approvals (reserve line only while none exists) with a race rule; a one-time reserve ask (always at onboarding); the payer table; cross-Waypoint Forger turns never debit a Run.
- **G6 Joint amendment set** without authority, N ≥ 1; joint components carry a narrowed amendment request, sealed only by `SubmitJointRunAmendment` from listed source states; one receipt; N-Run compare-and-set; `changed` (never `stale`) with closed causes and a re-check dialogue; `initial` components need Start; proxy-side revision prerequisites settle before approval; a proxy side needing a Run follows Pedro's Begin and re-enters as a two-Run set (Q3).
- **G7 Task hold** as a Run-targeted Control-request kind with an exact task set (named plus descendants), placed only by an admitted typed Forger hold proposal or a user action; named hold commands; held Workers `paused` with identity kept across the new session; one held-task time limit for every wait on others (Q9).
- **G8 Narrower closure for joint components only** (UD3; C5, provisional): `unaffected-continuing`, successor-epoch seals with a declared carry, a `continuing-result` Candidate arm, no Run transition, rejection releases holds and resumes the prior plan; the hold lifecycle table.
- **G9 Decision dependency** as one more typed member of the single Memory set, with an Evidence floor, a decision-owned change event, a separate read step and a decision-arm-only change to ADR 0017:88, :157, :171.
- **G10 Retirement as a revision with no in-force content; meaning version with a user-only wording-only link** (UD5: scope and link edits are never wording-only).
- **G11 Echoes at Integration application, anchored; two-pass search over one capture with an ADR 0022-owned outcome vocabulary; one decision-change item with one decision point per row** (UD4, UD6; J3 refinement recorded in §93).
- **G12 Provisional labels** (C8). Only named clauses carry the label, with the exact text **"Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8)."** Provisional: the change item's row layout and resolution actions; the two search passes and their funding; echo granularity and the recording moment; update-work hosting; the Evidence floor; the joint-only scope of the narrower closure (C5). Never provisional (safety invariants): decision revisions as mandatory dependencies; effective stale at read; stale terminal; retirement as a revision; the mark is user-only and scope or link edits are never wording-only; never "none found" on a failure; privacy.
- **G13 FRD Open Question 1 stays open.** Every new record carries an optional, typed provenance reference whose union can grow by amendment: the dialogue closing state (always), an interface-record revision (if Pedro chooses a new record), or a decision revision (if he chooses Decisions). Provenance never enters an authority reference (ADR 0011:44). Effects of each answer: a new interface record needs its own owner, source-selection rule (like ADR 0022:34) and the same meaning-version, event and echo pattern, and decides whether Runs other than the involved ones receive technical agreements; Decisions would need a flag keeping agreements off the Decisions page and Attention (FRD :79) and conflicts with UD1's "no approval"; dialogue records only changes nothing; Verified Memory needs an Evidence member (G9).
- **G14 One slice, one review, one commit** (R4). Amendments are written Proposed in the candidate; Pedro's acceptance of the candidate also accepts them, and the single commit carries Accepted status (Q12), recorded in the decisions log.
- **G15 Every user action can be undone, or records why not and asks for confirmation first** (Pedro, §93 and §94 R8: "temos que ter em conta enganos humanos de maneira a podermos desfazer a accao"). Reversal never rewrites history: it is a new recorded action or revision (ADR 0006:36; ADR 0017:61). Each undo lives on a surface that survives the item closing. **Spent coordination budget** (one rule, Q16): any action that starts paid turns records the spend as irreversible; it asks for confirmation only when the payer is at or above its 80% warning.

  | User action | Undo or reversal (where it lives) | Not reversible (reason) — confirm first |
  |---|---|---|
  | Edit a decision without the wording-only mark | a new edit can restore the text (Decisions page); the mark cannot be added afterwards | Bound memories go stale for good (ADR 0017:61); confirm, naming the memories, echoes and pinned Runs |
  | Accept a Supervisor decision revision in a Decision checkpoint | as above | as above |
  | Wording-only mark (FR16) | "Mark as meaning changed" (C11) (Decisions page, decision history) | Until undone, dependants stay trusted; confirm, naming them |
  | "Mark as meaning changed" | — | Memories that went stale stay stale; documents stay listed; confirm, naming dependants |
  | Retire a decision (FR17) | Restore (Decisions page) | Bound memories stay stale after a restore; confirm, naming dependants |
  | Restore a retired decision | Retire again (Decisions page) | A new meaning version re-runs the change path (search, item, Run rows); confirm, naming pinned Runs |
  | "Keep the earlier version for this Run" (C9) | "Undo keep" (Run overview; the row returns while the Run is nonterminal) | — |
  | "Undo keep" | "Keep the earlier version" again (Run overview) | — |
  | "Ask the Forger for an amendment proposal" (per-Run row) | — | A single-Run amendment closes all Run dispatch until Pedro decides (ADR 0011:131, C5); confirm |
  | Approve or decline the Supervisor's proposed update | Decline: "Ask again" (decision history). Approve: Runs it leads to are cancelled through Run controls; a docs Waypoint is removed by a map revision | Work already integrated stays integrated; confirm approval |
  | "Ask again" (a new follow-up proposal) | Decline the new proposal (decision history) | Spent budget (rule above) |
  | "Proceed without search" | "Retry search" (decision history) | — |
  | "Retry search" | — | Spent budget (rule above) |
  | Begin a change Run or update Run | Cancel the Run (existing Run controls) | — |
  | Request changes on a completed Waypoint's Candidate (FR8) | — | The `request-changes` decision is final for that review request (ADR 0015:83, :154); confirm |
  | Contest a technical agreement (C4) | "Withdraw contest" (thread) | The appended message and spent budget cannot be undone; confirm |
  | "Withdraw contest" | Contest again (thread) | Held tasks resume and may start; seals made while uncontested include the agreement; confirm, naming the tasks |
  | Release held tasks (any non-Contest hold) | "Hold again" re-places a hold on tasks not yet started (thread) | Tasks started after the release cannot be un-started; a pending joint proposal becomes out of date (`HOLD_RELEASED`) and must be proposed again; confirm, naming both |
  | "Hold again" | "Release held tasks" (thread) | — |
  | Stop a cross-Waypoint dialogue (ADR 0021:47) | Open a new dialogue in the same thread (thread) | The closed dialogue and spent budget stay; holds stay until released; confirm |
  | Write a human message into a cross-Waypoint thread | — | The message is immutable and starts paid Forger turns (rule above); no confirmation below the warning |
  | Approve a joint proposal (FR6) | A later amendment proposal (single or joint) | Epochs are immutable (ADR 0011:22) and Runs continue at once (C7); confirm |
  | Reject a joint proposal | Pedro asks for a new proposal in the thread; the Forgers re-propose | Held tasks resume at once on the prior plan; work started cannot be un-started; confirm, naming the held tasks |
  | Approve a coordination budget, the reserve, or a raise (C1, C3, Q7) | A new revision with lower limits applies at once (budget surface) | Usage already spent is not refunded; confirm when raising |
  | "Leave unchanged" at a budget limit | "Approve a raise" (budget surface) | The paid dialogues end `stopped`; confirm |
  | Accept a map revision adding a docs-update Waypoint (C10) | A new map revision archives the Waypoint while it has no Run; with a Run, cancel it first (map view) | — |
  | Accept a map revision that changes relationships of an open dialogue | A new map revision restores the link (map view) | The admission does not come back (a new relationship revision); stalled dialogues and a paid conflict scan follow; confirm, naming the dialogues |
  | Supervisor admission of an unlinked pair | Not a user action; Pedro can stop the dialogue (row above) | — |

## Slices

The deliverable is documentation: one slice (R4). It writes the amendment text into the repository's ADRs and product documents on a branch, as **Proposed**; Pedro's acceptance of the candidate also accepts the amendments, and the slice lands on `main` in one commit with **Accepted** status (Q12). There is no SlopStop behaviour change, so there is no red-green proof (AGENTS.md "Test Discipline": documentation-only decision work uses its document gates).

### S1 `c99-s1-adr-amendments` — the whole amendment set
- **Part A, dialogue, Supervisor and Run-absent effects.** ADR 0021 "Amendment 1: Phase 2 cross-Waypoint dialogue" (Architecture A, C, D; G1-G5, G13): closes the ADR 0021:20 note; notes :34 (proxy and follow-up map revisions), :35 and :37 (clarifying only), :42 (`agreement-class`), :43 (application end reasons), :48 (narrowed), :53 and :92 (budget replaced); scopes :46 to phase 1; adds the change-Run, joint and decision follow-up proposal kinds and the technical-agreement exception to :45; defaults rows; consequences at :80, :84; owns the dialogue and budget codes. ADR 0013 Amendment 1: the `project-coordination` subject arm, its ownership split, retry-authority child, partition and tables (:13 unaffected; :19, :29, :182, :234, :239-241, :268, :292, :344 named). ADR 0010 dated note: the `project-coordination` scope kind and child (:275-276, :386, :409-410, :433) and the `decision-search-capture` source (:220). Dated notes in ADR 0009 (:23, :30-31, :38, :39, :40, :43, :48-49, :53, :72, :97-98, :102, :108, :122, :124, :151-152, :175, :178, :183; Amendment 1 :221-228, :279, :288, :323), ADR 0007 (:25 unchanged, :27, :31-32, :43 unchanged, :47, :50, :69, :81, :106 fact), ADR 0006 (:41-58 dialogue, coordination-budget, effect and capture families; :62; :82-85; :102), ADR 0011 (:44, :55, :74-76, :125-126, :129, :214, :237), ADR 0015 (:91 capture source), ADR 0022 (:34, :42, :43), ADR 0020 (:47, :89 classified unaffected). `PRODUCT.md` :48, :52, :85-86, :100, :103, :111. `CONTEXT.md` :28, :33, :35, :37, :62, :63, :68, :71-73, :123-124 and new terms (Cross-Waypoint dialogue, Dialogue admission, Technical agreement, Plan-changing agreement, Contest, Supervisor proxy, Run-absent invocation, Run-absent read-only Project agent, Strand coordination budget, Project coordination reserve, Decision follow-up proposal, Change-Run proposal, Project-coordination effect, Project-coordination Evidence scope, Decision-search capture).
- **Part B, joint amendment and task hold.** ADR 0011 "Amendment 1: Joint cross-Waypoint amendment" (Architecture B; G6-G8): :9 note; :22, :25, :28; :35, :54; :93, :95; :127, :128, :130, :131, :133; :140, :145, :152, :164, :165, :166, :168; :172-173; :183-184; :203, :249 (kept, by the must-settle rule); command rows :212-217; :223-225; tables :236 (`joint_run_amendment_sets`, `_members`, `_views`, prerequisite conditions); :242, :247, :250; codes :271; closure rows :276-294 (including :286, :288). Dated notes in ADR 0007 (:26, :34, :36, :47, :50, :51, :56, :59-60, :79 `task-hold`, :94), ADR 0008 (:72-75 Worker-scoped hold checkpoint), ADR 0009 (:119-120, :127; Amendment 1 :272, :280), ADR 0015 (:37 kept; :48, :133, :148, :150-151 `continuing-result`), ADR 0021 (:57-58, inside Amendment 1). `PRODUCT.md` :104-107, :129. `CONTEXT.md` :58, :60, :66, :82 and new terms (Joint proposal, Joint amendment set, Task hold, Worker hold, Held-task time limit, and the copy mapping "proposta ultrapassada" → `changed`, "tempo de espera esgotado" → time limit reached).
- **Part C, decision staleness.** ADR 0017 "Amendment 1: accepted decision revisions as mandatory Memory dependencies" (Architecture E; G9) and ADR 0022 "Amendment 1: retirement, wording-only revisions, echoes and the decision-change item" (Architecture F; G10-G11), with G12 labels; ADR 0022:49 superseded by the single item; :50 extended to search outcomes; ADR 0022 owns the search-outcome vocabulary; proof rows (wording-only keeps trust; scope-only and links-only stale; retirement stales; restore does not revive; acceptance race; decision-only set rejected; decision-event delivery lag; mixed-set ordering). Dated notes in ADR 0006 (decisions family with revisions, meaning version, retirement kind, wording-only link, scope and implementer children, change event child, echo, search and row-answer families; :62, :70, :129, :136; :137 unchanged), ADR 0015 (echo claims in results and manifests; :97 as input to `RecordDecisionEchoes`), ADR 0011 (:10 trigger now via the single item; wording-only raises none), ADR 0009 (`retired` exclusion reason). `PRODUCT.md` :48, :64, :65, :80-81, :100, :123. `CONTEXT.md` :161, :163-164, :166-167, :170 and new terms (Mandatory Memory decision dependency, Retired decision, Decision meaning version, Wording-only revision, Decision echo, Decision echo search, Decision-change item, Attention, Evidence decision versus accepted decision revision, "desatualizada" → memory `stale`).

### Verification (document gates)
Sweeps run over the amended documents; a hit in a document outside the set, or an unrelated sentence, is recorded as "unrelated (reason)" in the review evidence (Q18).
- **D99-V1** Old-rule sweep A: `rg -n "only the user approves|typed proposal that the user decides|budgeted from the Run|(Forger|Waypoint[- ]parent) (or|and) (a )?Worker|coordination budget|fourth variant|fourth or generic|read-only Worker|run-workspace.*task-workspace.*candidate|run-worker.*project-operation.*integration" docs/adr PRODUCT.md CONTEXT.md` — every hit is new amendment text, named by a dated note, or recorded unrelated.
- **D99-V2** Authority paths: these clauses stay literally true — ADR 0021:44; "never changes files, approves anything, or starts a Run" (ADR 0021:34); ADR 0021:91; "Manual Actions create a Run only through Begin" (`PRODUCT.md:105`). Every cross-Waypoint message follows a recorded admission (`map-link` or `supervisor-admission`) and a routing event; every task hold traces to a coordinator-admitted typed Forger hold proposal or a named user action, never to message text; no Supervisor path creates a Run.
- **D99-V3** The technical-agreement test lists ADR 0011:84, every fingerprint input at ADR 0011:91, ADR 0011:174 and decision contradiction (UD2), each by name.
- **D99-V4** Every Model attempt maps to exactly one budget scope per the payer table (including hand-over, Contest and re-check dialogues, a Strand without a budget, pre-budget Strand searches, the follow-up proposal turn, Foundation inference); no cross-Waypoint Forger turn debits a Run; missing usage is never zero; every Run-absent provider dispatch has exactly one `project-coordination` Effect subject.
- **D99-V5** `DIALOGUE_ADMISSION_CHANGED`, detector not-run/failed, `COORDINATION_BUDGET_EXHAUSTED`, `COORDINATION_BUDGET_MISSING` and the application end reasons (`counterpart-run-started`, `counterpart-run-ended`, `hold-time-limit-reached`, `budget-left-unchanged`) each have a stable code or reason, and none reads as clean.
- **D99-V6** Closure sweep: `rg -n "closes (new )?(Run )?dispatch|dispatch stays closed|dispatch closes until|amendment-requested|\bStartRun\b|reopens dispatch|close their applicable dispatch" docs/adr PRODUCT.md CONTEXT.md` — every hit is joint-excepted, kept for single-Run amendments, or recorded unrelated.
- **D99-V7** Every complete-classification sentence (ADR 0011:35, :54, :140, :152, :166, :168, :223, :250, :288; ADR 0015:150-151; `PRODUCT.md:105`; `CONTEXT.md:60`) carries the joint-only `unaffected-continuing` exception, and the `continuing-result` arm is defined.
- **D99-V8** New text never names the joint state `stale`; Control-request target shapes (ADR 0007:77), Run causes (:43) and statuses (:32) are unchanged; kind lists (ADR 0007:79; `CONTEXT.md:58`) gain `task-hold` in step; joint component source states and `JOINT_COMPONENT_STATE_INVALID` are stated; only `SubmitJointRunAmendment` seals components; `CONTEXT.md` maps "proposta ultrapassada", "tempo de espera esgotado" and "desatualizada" to distinct states.
- **D99-V9** Every receipt clause (ADR 0011:37, :38, :60, :224, :248) is reconciled with the shared joint receipt; ADR 0006:66-69 is confirmed to allow it without change.
- **D99-V10** Each derived state (`changed`, held, all-remaining-held, time limit reached) has a distinct broken variant (ADR 0011:189, :293); every hold-placing path and every waiting state has a release row in the hold lifecycle table; the time limit covers `changed` re-checks, unavailable Forgers and lapsed admissions.
- **D99-V11** Old-rule sweep C: `rg -n -i "evidence dependenc|evidence_dependenc|mandatory dependenc|same-Project Evidence|family current tables|Evidence recheck|any exact decision|new current revision|Decision changed|exact equality|any mandatory dependency" docs/adr PRODUCT.md CONTEXT.md` — every hit noted, amended or recorded unrelated.
- **D99-V12** Ownership: the decision owner never reads Memory; Memory never moves a decision pointer; Integration never writes decision or echo state; the Supervisor never approves, begins or reads code; the Project agent never writes and has no tools.
- **D99-V13** Every new outcome keeps `failed`, `truncated`, `not-run`, `pending` distinct from `empty`; an unreadable decision row returns `failed`; ADR 0022 owns the search vocabulary and ADR 0017:96 is unchanged.
- **D99-V14** The change event child, echo rows, row answers, contest records and diagnostics contain no decision text, excerpt or path.
- **D99-V15** Every provisional clause, in every amended document, carries exactly "Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8)."; `rg -n -i "first real use|after (first|real) use|usage trigger"` over the amended documents finds no usage trigger in new text; the invariant list is stated as not provisional.
- **D99-V16** New text uses the qualified names ("Evidence decision", "accepted decision revision") everywhere.
- **D99-V17** `git diff` on each accepted ADR shows only a Status-line suffix, a dated note block and appended Amendment sections; no accepted ADR sentence is rewritten; `PRODUCT.md` and `CONTEXT.md` edits are limited to the listed lines.
- **D99-V18** The Traceability table below is carried into the amendment change and every row maps to an exact amendment clause and a D99 row; none unmapped.
- **D99-V19** FRD Open Question 1 is untouched: no text makes the provenance arm authoritative, chooses a storage, or delivers technical agreements to Runs other than the involved ones.
- **D99-V20** New text uses Forger and Strand; "Waypoint parent" and "Feature" appear only in former-name notes.
- **D99-V21** One commit carries every amended document (G14).
- **D99-V22** Every user action the amendments introduce **or whose effect they change** appears in G15's table with an undo (and the surface where it lives) or with a recorded reason and a confirmation step; the amendment text states each one, and the spent-budget rule is applied uniformly.
- **D99-V23** The wording-only mark and the `wording-only-of` link appear only on Pedro's direct Decisions-page edit command, never in proposals, checkpoints, follow-up proposals or agent-message shapes.
- **D99-V24** Every row of the decision-change item holds exactly one decision point (alternatives listed) or is information-only; every row answer has an owner record and a resolution rule.
- **D99-V25** Every new Amendment section and note is Proposed in the candidate and Accepted in the commit, with the acceptance recorded in the decisions log (Q12).
- **D99-V26** The coordination-budget lines are sealed and hashed in the first Run approval (the reserve line only while no approved reserve exists); `ApproveCoordinationReserve` and the one-time ask (always at onboarding) are stated; the race rule and `COORDINATION_BUDGET_PROPOSAL_CHANGED` are stated.
- **D99-V27** ADR 0013's subject union, ADR 0010:409 (scope kinds), ADR 0010:386 (typed-scope tables), `CONTEXT.md:71-73`, :123-124, `PRODUCT.md:111` and the ADR 0006 effect family list `project-coordination` in step; the arm's owners (coordinator, Execution, Evidence), retry-authority child, partition, tables and absent fields (Run, Worker, Process job, mutation) are stated.
- **D99-V28** (R3, R21, Q3) Every plan-changing cross-Waypoint agreement, including one with a proxy side, uses the joint commands with N ≥ 1; a proxy-side revision is a sealed `pending` condition settled before approval, never a task edge, task input or new task-input source kind; a proxy side needing a Run follows Pedro's Begin and re-enters as a two-Run set, closing the one-Run set with `PREREQUISITE_RUN_STARTED`.
- **D99-V29** (UD5, FR16, AC9, C11) A wording-only revision emits no `decision-current-meaning-replaced` event, stales no memory, flags no document, runs no search and raises no Run row; the mark stays in history; scope or link edits are refused with `DECISION_WORDING_ONLY_NOT_APPLICABLE`; "Mark as meaning changed" runs the full path.
- **D99-V30** (Q15) No new text ties a decision member's staleness to the decision's current pointer; `PRODUCT.md:64` and `CONTEXT.md:167`, :170 use the meaning-version wording; ADR 0017:59, :86, :157 and :171 carry the decision exception.
- **D99-V31** (NFR UX, AC3) No technical-agreement entry, thread event or Contest creates an Attention item or Decisions-page entry, except the Attention rows Pedro decided (R9 contest close, R10/Q9 time limit, hold rows after a failed close, budget limits, the reserve ask, C1).
- **D99-V32** (C4, R9) The technical-agreement entry records each involved Run's accepted `DelegationTaskId`s and epoch; Contest maps them to the current plan and reports missing ones; a contested agreement appears in no new Sealed Invocation; a Contest hold's only release reasons are technical re-agreement and withdrawal; Contest and withdrawal are immutable records.
- **D99-V33** (FR6, FR7, AC4, AC5) The joint set appears as exactly one Attention item; Approve and Reject decide all N components; the N-Run compare-and-set lists set hash, cardinality, epochs, holds and prerequisites and rejects the whole command on any failure; every closed `changed` cause makes the set unapprovable and opens a re-check dialogue.
- **D99-V34** (AC7, FR9, C1, C3) The 80% warning shows in the thread and on the budget surface, not in Attention; one Attention item per budget lists held tasks; no message is sent after the limit; the reserve at its limit blocks every reserve-paid turn; the per-dialogue message limit still applies.
- **D99-V35** (FR2, AC1, FR3) A linked pair (`blocks` either way or `related-to`) opens without a user prompt; an unlinked pair shows the Supervisor admission in the thread; `derived-from` is excluded; the detector fires on epoch activation, accepted map revisions and meaning-changing decision events only.
- **D99-V36** (FR13, FR14, C10, Q6, Q19) Echoes are recorded only from an `applied` Integration proof's changed paths, anchored; both search passes read the same `decision-search-capture`; the Project agent has no tools; memory and document update work use the same host rule, with the docs-update Waypoint proposed by map revision when no host exists.
- **TDD-exempt**: S1 — documentation-only decision work (AGENTS.md "Test Discipline": it may use its document validation gates and cannot classify a behaviour change as documentation; this slice changes no SlopStop behaviour, and every future build of these amendments still follows red-green).

### Traceability
| Source | Design | Amendment location | Check |
|---|---|---|---|
| FR1 (keep parallel Waypoints, one Run each) | kept; ADR 0007:31, `PRODUCT.md:109` | no change | V17 |
| FR2 linked pairs | A, G3 | ADR 0021 Amendment 1; ADR 0006:82-85 note | V35 |
| FR3 Supervisor-opened dialogues | A (detector), C | ADR 0021 Amendment 1; ADR 0009, ADR 0013 | V35, V4 |
| FR4 affected-task hold | B, G7 | ADR 0011 Amendment 1; ADR 0007, 0008, 0009 notes | V6, V8, V10 |
| FR5 technical agreements | A, G2 | ADR 0021:45 exception; `PRODUCT.md:103` | V2, V3, V19, V31 |
| FR6 joint proposal | B, G6 | ADR 0011 Amendment 1 | V33, V6-V9 |
| FR7 epoch staleness | B (`changed`, re-check) | ADR 0011:183-184 note | V33, V8, V10 |
| FR8 Waypoint without a Run | A, G6 (R21, Q3) | ADR 0021 Amendment 1; ADR 0011:125-126, :203 | V28, V2 |
| FR9 Strand budget | D, G5 | ADR 0021 Amendment 1; ADR 0006 note | V34, V4, V26 |
| FR10 requesting Strand pays | D | ADR 0021 Amendment 1 | V4 |
| FR11 decision as memory dependency | E, G9 | ADR 0017 Amendment 1 | V11, V16, V30 |
| FR12 immediate staleness | E | ADR 0017 Amendment 1 | V11, V13, V30 |
| FR13 echo links | F, G11 | ADR 0022 Amendment 1; ADR 0015 note | V36, V12, V14 |
| FR14 change-time search | F, C (R17, Q6) | ADR 0022 Amendment 1; ADR 0013, ADR 0010 | V36, V4, V13 |
| FR15 one decision-change item, proposed update | F, G11 | ADR 0022:49 superseded | V24, V22, V36 |
| FR16 wording only | F, G10 | ADR 0022 Amendment 1 | V29, V23 |
| FR17 retirement | F, G10 | ADR 0022 Amendment 1 | V11, V30 |
| NFR Performance (cost guarded) | D | ADR 0021 Amendment 1 | V4, V34 |
| NFR Security (no authority; user-only mark) | A, F | ADR 0021:44 kept; ADR 0022 | V2, V23 |
| NFR UX (technical agreements never in Attention or Decisions; Attention widened by C1, R9, R10, Q9 and the hold rows) | A, B, D | ADR 0021 Amendment 1 | V31 |
| NFR Reliability (changed or stale is visible; effective at read) | B, E | ADR 0011, ADR 0017 | V10, V13, V30 |
| AC1 linked pair opens without prompt; unlinked shows admission | A | ADR 0021 | V35 |
| AC2 only affected tasks show "paused at safe point" | B | ADR 0011 | V6, V10 |
| AC3 technical agreement: no Attention, visible in thread | A | ADR 0021 | V31 |
| AC4 one Attention item; approve changes both; reject neither | B | ADR 0011 | V33 |
| AC5 another amendment makes the joint proposal out of date | B (`COMPONENT_SUPERSEDED`) | ADR 0011 | V33 |
| AC6 finished Waypoint answered by the Supervisor; change-Run proposal | A | ADR 0021 | V28 |
| AC7 requesting Strand charged; 80% warning; limit item | D | ADR 0021 | V34, V4 |
| AC8 replace or retire excludes memories at once; item lists everything | E, F | ADR 0017, ADR 0022 | V30, V24 |
| AC9 wording only keeps memories trusted; mark in history | F | ADR 0022 | V29 |
| UD1 technical agreements need no approval | A, G2 | ADR 0021:45; `PRODUCT.md:103` | V2, V31 |
| UD2 contract/result-schema changes or decision contradiction are plan-changing | A, G2 | ADR 0021 Amendment 1 | V3 |
| UD3 only affected tasks stop; rejection resumes the prior plan | B, G8 | ADR 0011 Amendment 1 | V6, V33 |
| UD4 one decision-change item, one action per Run | F, G11 | ADR 0022 Amendment 1 | V24 |
| UD5 wording only suppresses per-Run notices; scope/link edits are real | F, G10 | ADR 0022 Amendment 1 | V29 |
| UD6 Project reserve for Supervisor dialogues and Project-scope searches | D, G5 | ADR 0021 Amendment 1 | V4, V34 |
| C1 budget approval moment | D, G5 | ADR 0011:44, :55, :74-76, :214 notes | V26 |
| C3 reserve at limit | D | ADR 0021 | V34 |
| C4 Contest | A, G15 | ADR 0021 | V32, V22 |
| C5 joint-only closure, provisional | B, G8, G12 | ADR 0011 | V6, V15 |
| C6 held tasks while `changed` | B (lifecycle, re-check) | ADR 0011 | V10, V33 |
| C7 Runs continue after joint approval | B | ADR 0011:130, :133, :165 notes | V6 |
| C8 provisional scope and trigger | G12 | every amended document | V15 |
| C9 keep earlier version | F, G15 | ADR 0022 | V24, V22 |
| C10 docs-update Waypoint | F | ADR 0022, ADR 0021 | V36, V22 |
| C11 mark as meaning changed | F, G15 | ADR 0022 | V29, V22 |
| G11 one decision point per row | F | ADR 0022 | V24 |
| G15 undo rule (with R8 escape) | G15 | every amendment | V22 |
| R1 project-coordination Effect subject | C, G4 | ADR 0013, ADR 0010 | V27, V4 |
| R3 proxy prerequisite settles before approval | A, G6 | ADR 0011 Amendment 1 | V28 |
| R4 one slice | G14 | — | V21 |
| R9 Contest hold lifts only on re-agreement or withdrawal | A, B | ADR 0021, ADR 0011 | V32 |
| R10 hold time limit | B | ADR 0011; ADR 0021 defaults row | V10 |
| R15 reserve pays pre-budget Strand searches | D | ADR 0021 | V4 |
| R17 Run-absent read-only Project agent | C, F | ADR 0022:43; ADR 0009; ADR 0013; ADR 0010 | V12, V27, V36 |
| R21 joint path with N = 1 | A, B | ADR 0011, ADR 0021 | V28 |
| Q3 completed proxy Waypoint: Begin first, then a two-Run set | A, G6 | ADR 0021, ADR 0011 | V28 |
| Q7 onboarding asks once for the reserve | D | ADR 0021 | V26 |
| Q9 time limit covers waits on others; app stops with a named reason | A, B | ADR 0021:43 note; ADR 0011 | V10, V5 |
| Q12 acceptance of the candidate accepts the amendments | G14 | every amended document | V25 |
| Q21 Portuguese copy | B, E | `CONTEXT.md` | V8 |
| FRD Open Question 1 (storage) | G13 | none (kept open) | V19 |
| FRD Open Question 2 (naming affected tasks; pausing a Worker) | B, G7 | ADR 0011, ADR 0007, ADR 0009 | V2, V8, V10 |
| FRD Open Question 3 (numbers) | D | ADR 0021 defaults rows (open) | — (deferred) |
| Research design questions (pair shape; thread owner; map change; Supervisor contract; joint shape; "no active Run"; retire semantics; echo moment and search owner; update hosting) | G1, A; A; A, G3; C, G4; B, G6; A; F, G10; F, G11; F | as above | V2, V27, V33, V36 |

## Deferred Work
- **Building any of this.** Trigger: the Runs/Execution build reaches cross-Waypoint dialogue or decisions; each future slice carries its own contracts and red-green proof. Nothing here authorizes code.
- **FRD Open Question 1** (where technical agreements are stored for future Runs; also whether Runs other than the involved ones receive them). Owner: Pedro. Trigger: his choice; G13 states each answer's effect.
- **FRD Open Question 3 and the held-task time limit** (numbers). Trigger: measured evidence or Pedro setting values (ADR 0009:163).
- **Revisit of the provisional clauses** (G12). Trigger: only when Pedro asks (C8).
- **FRD suggested follow-ups:** map change under a running Run; Attention item for Run-to-Run conflicts; two Runs touching the same code (`PRODUCT.md:110`; ADR 0008:105).
- **Protocol shapes** (`packages/protocol/src/workspace-protocol.ts:55`, :111-118, :289-299, :337-354, :425-440) and kernel identifiers. Trigger: the first behaviour slice that needs them.

## Verification Notes
- **Risks.** The amendment set touches eleven ADRs (0006, 0007, 0008, 0009, 0010, 0011, 0013, 0015, 0017, 0021, 0022), classifies ADR 0020 as unaffected, and edits `PRODUCT.md` and `CONTEXT.md`; the main risk is a missed sentence stating an old rule, guarded by D99-V1, V6, V7, V11, V15, V17 and V27. The most delicate authority changes are the `unaffected-continuing` relaxation (G8, joint-only, provisional) and the `project-coordination` Effect subject and Evidence scope kind, which lift closed unions in ADR 0013 and ADR 0010 for one arm. Pedro flagged (§91) that he is still unsure how memories and decisions will work in practice, and the coordinator noted the growing size (§94); the provisional labels (G12), "revisit only when Pedro asks", and the closing path (A) with no further review rounds are the agreed answer.
- **Review lane.** Rigorous: round 1 failed (88 findings; R1-R30 applied in revision 2); round 2, the last, failed (76 findings; Q1-Q22 applied in revision 3). Closing path (A, §95): the coordinator checks each item against the resolution table below, then Pedro approves; his acceptance of the slice candidate later also accepts the amendments (Q12).
- **Machine.** No new agents for revision 3.

## Developer Context

**Request.** Coordinator hand-off, 2026-10-16: run `/rpiv:design` from the research; documents only; propose the ADR amendments without editing them; keep FRD Q1 open; questions for Pedro go through the coordinator.

**Inherited decisions** (not asked again): FRD Decisions (FR1-FR17; research "Developer Context"); §92 UD1-UD6.

**How the draft was made.** Three option analysts (dialogue and Supervisor; joint proposal and hold; decision staleness) returned options, eliminations and recommendations per question; the designer reconciled them.

**Developer checkpoints — answered by Pedro (decisions log §93)**
- **C1** (a): Strand budget inside the first Run approval of that Strand; Project reserve inside the Project's first Run approval; a Project-scope search before any Run asks once through Attention.
- **C2** was not a question (the Strand budget at its limit follows FR9).
- **C3** (a): at its limit the Project reserve raises one Attention item and no new Supervisor-opened dialogue or search runs until Pedro decides.
- **C4** (a): Contest holds the agreement's tasks until the agents re-agree or the contest is withdrawn.
- **C5** (a): the narrower closure applies to joint proposals only, labelled provisional; single-Run amendments keep the whole-Run stop.
- **C6** (a): held tasks stay held while the Forgers re-check, for a bounded time; Pedro can release them.
- **C7** (a): after joint approval the Runs continue on their own.
- **C8** scope (a): named clauses only, safety invariants never provisional; trigger (c): review only when Pedro asks ("Quando eu pedir").
- **C9** (a): "Keep the earlier version for this Run".
- **C10** (a): the Supervisor proposes a docs-update Waypoint through a map revision.
- **C11** (a): "Mark as meaning changed"; plus Pedro's general rule G15.
- **G11** accepted: "one exact action per row" inside one item.

**Round 1 answers — Pedro (decisions log §94)**
- **R4** one slice, one review, one commit. **R8** an action that cannot be undone records why and asks for confirmation first. **R9** a contest hold lifts only on re-agreement or Pedro's withdrawal; a no-agreement, needs-human or stopped close keeps the hold and raises Attention. **R10** held tasks of an out-of-date joint proposal have an elapsed-time limit (number open); at expiry, Attention. **R15** before a Strand's budget exists, the Project reserve pays that Strand's decision searches. **R17** the change-time search and Foundation inference use a Run-absent read-only Project agent, not a Worker. **R21** a plan-changing agreement with a Waypoint without a Run uses the joint path with one Run. The designer applied R1-R30 in revision 2.

**Round 2 answers — Pedro (decisions log §95)**
- **Q3** for a completed proxy Waypoint, Pedro's Begin of its change Run comes first; then the agreement re-enters as a two-Run joint set with that Waypoint's real Forger. **Q7** at onboarding, the Project reserve for Foundation inference is asked once via Attention. **Q9** the held-task time limit also covers a dialogue waiting on an unavailable Forger or a lapsed map link; at expiry the app stops the dialogue with a named reason and raises Attention, and never sets an agent's closing state. **Q12** acceptance of the slice candidate also accepts the ADR amendments; the single commit carries Accepted status. **Q21** copy "proposta ultrapassada", "tempo de espera esgotado", "desatualizada". **Closing path (A):** revision 3 applying Q1-Q22, a resolution table mapping each finding to lines, the coordinator checks each item with no new agents, then Pedro approves.

**Status.** `in-review` pending the coordinator's item-by-item check of revision 3 and Pedro's approval.

### Revision-2 round-2 resolution
Each round-2 finding (evidence `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-2.md`) maps to its resolution group (Q1-Q22) and to the revision-3 lines that apply it. Line numbers refer to this file.

| Finding | Severity | Resolution | Applied at (this brief) |
|---|---|---|---|
| X-01 | blocker | Q1 | :31, :50, :118, :119, :236, :242, :268 |
| X-02 | concern | Q5 | :116, :118, :236, :268 |
| X-03 | concern | Q6 | :117, :157, :277 |
| X-04 | concern | Q2 | :63, :103, :104, :218, :273 |
| X-05 | concern | Q10 | :84, :127, :245 |
| X-06 | concern | Q7, Q8 | :126, :267, :340 |
| X-07 | concern | Q9 | :61, :89, :99, :251, :341 |
| X-08 | concern | Q11 | :62 |
| X-09 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| X-10 | concern | Q3 | :69, :73, :111, :175, :269, :332, :339 |
| X-11 | concern | Q12 | :46, :197, :233, :266 |
| X-12 | concern | Q18 | :236, :241, :256, :358 |
| S-01 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |
| R2-FIT-01 | blocker | Q1 | :31, :50, :118, :119, :236, :242, :268 |
| R2-FIT-02 | concern | Q5 | :116, :118, :236, :268 |
| R2-FIT-03 | concern | Q6 | :117, :157, :277 |
| R2-FIT-04 | concern | Q6 | :117, :157, :277 |
| R2-FIT-05 | concern | Q2 | :63, :103, :104, :218, :273 |
| R2-FIT-06 | concern | Q9 | :61, :89, :99, :251, :341 |
| R2-FIT-07 | concern | Q9 | :61, :89, :99, :251, :341 |
| R2-FIT-08 | concern | Q3 | :69, :73, :111, :175, :269, :332, :339 |
| R2-FIT-09 | concern | Q13 | :79, :80, :249 |
| R2-FIT-10 | concern | Q13 | :79, :80, :249 |
| R2-FIT-11 | concern | Q8 | :126, :267 |
| R2-FIT-12 | concern | Q14 | :157, :254 |
| R2-FIT-13 | concern | Q12 | :46, :197, :233, :266 |
| R2-FIT-14 | suggestion | Q18 | :236, :241, :256, :358 |
| R2-FIT-15 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |
| R2-FIT-16 | suggestion | Q18 | :236, :241, :256, :358 |
| R2-FIT-17 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |
| R2-FIT-18 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |
| R2-FIT-19 | suggestion | Q4 | :270, :313, :318 |
| R2-FIT-20 | suggestion | Q11 | :62 |
| R2-FIT-21 | suggestion | Q2 | :63, :103, :104, :218, :273 |
| R2-FIT-22 | suggestion | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-01 | blocker | Q4 | :270, :313, :318 |
| VC2-02 | concern | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| VC2-03 | concern | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| VC2-04 | concern | Q2 | :63, :103, :104, :218, :273 |
| VC2-05 | concern | Q10 | :84, :127, :245 |
| VC2-06 | concern | Q9 | :61, :89, :99, :251, :341 |
| VC2-07 | concern | Q3 | :269, :332 |
| VC2-08 | concern | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| VC2-09 | concern | Q1 | :242, :268 |
| VC2-10 | concern | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| VC2-11 | concern | Q19 | :165, :277 |
| VC2-12 | concern | Q18 | :236, :241, :256, :358 |
| VC2-13 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-14 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-15 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-16 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-17 | suggestion | Q22 | :331, :332, :344, :347 |
| VC2-18 | suggestion | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| VC2-19 | suggestion | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-20 | suggestion | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-21 | suggestion | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-22 | suggestion | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| VC2-23 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |
| R2-ADR-01 | blocker | Q1 | :31, :50, :118, :119, :236, :242, :268 |
| R2-ADR-02 | blocker | Q2 | :63, :103, :104, :218, :273 |
| R2-ADR-03 | blocker | Q3 | :69, :73, :111, :175, :269, :332, :339 |
| R2-ADR-04 | concern | Q9 | :61, :89, :99, :251, :341 |
| R2-ADR-05 | concern | Q9 | :61, :89, :99, :251, :341 |
| R2-ADR-06 | concern | Q20 | :71, :243 |
| R2-ADR-07 | concern | Q18 | :236, :241, :256, :358 |
| R2-ADR-08 | concern | Q15 | :145, :146, :271 |
| R2-ADR-09 | concern | Q15 | :145, :146, :271 |
| R2-ADR-10 | concern | Q8 | :126, :267 |
| R2-ADR-11 | concern | Q16 | :198, :209, :212, :218, :219, :221, :222, :224, :228 |
| R2-ADR-12 | concern | Q17 | :272, :273, :274, :275, :276, :277, :284, :295 |
| R2-ADR-13 | concern | Q6 | :117, :157, :277 |
| R2-ADR-14 | concern | Q5 | :116, :118, :236, :268 |
| R2-ADR-15 | suggestion | Q2 | :63, :273 |
| R2-ADR-16 | suggestion | Q21 | :83, :238, :343 |
| R2-ADR-17 | suggestion | Q18 | :236, :241, :256, :358 |
| R2-ADR-18 | suggestion | Q22 | :85, :101, :116, :172, :216, :302, :344, :347 |

### Implementation (c99-s1, 2026-10-16)
- Implementer: Claude Opus 5.5, in the linked worktree `C:/Users/pedro/Documents/GitHub/slopstop-99`, branch `docs/99-cross-waypoint-dialogue`, base `1b2256a`, under the build authority of decisions log §96 (relayed by the coordinator).
- Written as **Proposed**: ADR 0011, 0013, 0017, 0021 and 0022 Amendment 1; dated notes in ADR 0006, 0007, 0008, 0009, 0010 and 0015; `PRODUCT.md` and `CONTEXT.md` edited on the listed lines. ADR 0020 classified unaffected in the ADR 0010 note.
- TDD-exempt (documentation-only decision work). Verification rows D99-V1..V36, gates and traceability: `.rpiv/artifacts/evidence/2026-10-16_c99-amendments-evidence.md`. V25's acceptance half (flip to Accepted plus the decisions-log record) waits for Pedro's acceptance of the candidate.
- Lane: `lane.mjs --paths` over the 13 changed files said `normal`; raise-only keeps `rigorous`.

### Candidate review round 1 (2026-10-16)
- Round 1 on `a7c6625` failed (table K1-K21: `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/review-candidate-round1.md`). Pedro's decisions (decisions log §97):
  - **K5 (added beyond the approved text):** the hold lifecycle gains three rows. A completed-proxy change-Run wait has a "Decline" action, which releases the waiting holds (`released-on-change-run-declined`) and makes a pending one-Run set `changed` with `PREREQUISITE_CHANGED`. The held-task time limit also covers an unavailable Supervisor proxy. A Contest hold on an ended Run is released (`released-on-run-end`). The `PREREQUISITE_RUN_STARTED` closing carries the holds into the two-Run set.
  - **K6:** the `process-execution` ban for the `project-coordination` arm is removed; how Run-absent governed CLI sessions are launched goes to issue #136.
  - **K7:** ADR 0022:48 is named: a decision edit itself still pauses nothing, but a conflict dialogue that follows may hold only the affected tasks.
  - **K2:** ADR 0019 and `PRODUCT.md:124` join the amended set.
  - **K21:** after acceptance, the Proposed→Accepted flip is checked by the coordinator through a diff, with no fresh review.
  - The coordinator approved K13's lines beyond the listed ones. K1-K20 are applied in one fix commit; round 2 is the last.

### Candidate review round 2 (2026-10-16)
- Round 2 (the last) on `bb28854` failed with follow-on gaps (table L1-L14: `.rpiv/evidence/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness/review-candidate-round2.md`). Pedro's decisions (decisions log §98):
  - **L1:** follow ADR 0018 as it is. The capture content Artifact is `evidence-produced`, so ADR 0018's matrix gives it the `durable-record` purpose; no new byte-hold kind; ADR 0018 stays outside the set.
  - **Path:** one final fix commit for L1-L14, with no third review round; the coordinator checks every item and records the unreviewed delta as residual risk. After Pedro's acceptance, the coordinator checks the Proposed→Accepted flip by diff (12 ADRs: 5 Amendment sections and 7 dated notes, plus their Status lines).
  - **L2:** ADR 0020:98 is not edited; it is recorded as a stale count of the limit-owner arms.

## References
- `.rpiv/artifacts/research/2026-10-16_17-01-10_cross-waypoint-dialogue-and-decision-staleness.md`
- `.rpiv/artifacts/discover/2026-10-16_16-32-45_cross-waypoint-dialogue-and-decision-staleness.md`
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §18, §27, §90-§95 and :192
- `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-1.md`, `.rpiv/artifacts/evidence/2026-10-16_c99-design-intent-review-2.md`
- `docs/adr/0006`, `0007`, `0008`, `0009` (Amendment 1), `0010`, `0011`, `0012`, `0013`, `0015`, `0017`, `0018`, `0019`, `0020`, `0021`, `0022`
- `PRODUCT.md`, `CONTEXT.md`, `AGENTS.md`
- `.rpiv/decisions/degrade-distinguishes-broken.md`, `.rpiv/decisions/shared-vocab-union.md`
- GitHub #99
