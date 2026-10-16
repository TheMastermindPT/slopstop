# ADR 0021: Supervisor, Forger And Application-Mediated Agent Dialogue

- Status: Accepted (2026-10-09); amended 2026-10-16 (see Amendment 1, Accepted)
- Date: 2026-10-09
- Decision owners: Pedro Mesquita
- Issue: [#99](https://github.com/TheMastermindPT/slopstop/issues/99)
- FRD: [Agent coordination and dialogue](../../.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §21, §25, §27

## Note (2026-10-10): former names

This ADR uses "Feature", the former name of **Strand** (decisions log §30; see `CONTEXT.md` Former Names). The two names denote the same concept; this note changes no decision.

## Note (2026-10-10): v1 scope decisions

The user decided (FRD `.rpiv/artifacts/discover/2026-10-10_00-59-10_v1-scope-deferred-decisions.md`; decisions log §31):
- Dialogue stays pair-only: one recipient per message, two participants per dialogue. One agent may hold several pair dialogues at once, each with its own subject, limit and closing state.
- The provisional default for messages per agent per dialogue is **12** (replaces 6 in the Provisional defaults table), still visible and editable in the Project profile.
- The closing state is a mandatory, fixed-format field declared by each agent and validated by the application; a missing or invalid field refuses the message. The application never infers it from free text.
- Phase 2 (cross-Waypoint dialogue through the Supervisor, with the Supervisor coordination budget) is in v1. Its mechanics across Runs at different epochs are left to design.

## Context

ADR 0007 makes one logical Waypoint parent the supervisor of each Run and Workers the executors of single Delegation tasks. ADR 0009 forbids Workers from creating, joining or coordinating one another, and gives each agent its own Turn Machine and Invocation context record. No construct lets one agent send content to another except fan-in results, Finding remediation handoffs (ADR 0014) and Task-input snapshots (ADR 0015).

The user ran a peer dialogue between agents during design work (2026-10-08/09), judged it a success, and decided that Ragnarok should let agents collaborate. The user's mandatory limits are: cost stays under control; agent dialogue is visually separate from the human conversation; agent messages never interrupt what the user is writing; and the user always has the last word.

## Decisions

### Roles

- Rename the Waypoint parent to **Forger** in product language. ADRs 0007-0020 and existing code identifiers keep "Waypoint parent" as the former name until a dedicated implementation slice migrates them; the two names denote the same role.
- Add a **Supervisor** role. The Supervisor is the agent the user talks to in the Project conversation. In a Waypoint conversation it is the same agent, scoped to that Waypoint's context.
- The Supervisor plans and coordinates; it never changes files, approves anything, or starts a Run. When it recognises that a request is work, it asks whether to split it. Only on the user's yes does it propose new or changed Features and Waypoints and their order, through a short Frame that becomes a map revision only on explicit acceptance.
- The Supervisor commissions deep and architecture reviews (when and with what scope) and interprets their results. Read-only reviewer Workers do the code reading (PRODUCT.md: model-directed reads that become Evidence belong to attributed Workers). Findings remain proposals for the user.
- Inside a Run, the Forger remains the only agent that splits work into tasks, merges results and proposes plan changes (ADR 0007, ADR 0009 fan-out/fan-in rules are unchanged). The user talks to the Forger only through the Run overview ("Talk to the agent running Run N"), and that dialogue stays linear.
- Workers belong to one of two families: **doers**, which may change files within their Run workspace resources, and **readers**, which only research or review and never mutate anything.

### Agent dialogue

- Agents may exchange messages only through an **application-mediated agent dialogue** owned by Execution. Direct agent-to-agent channels, shared provider sessions and hidden memory remain prohibited (ADR 0009, ADR 0015).
- Each message is durable, attributed and immutable. It carries free text plus an **envelope**: recipient, subject, and a closing state (`agreement`, `no-agreement` or `needs-human`).
- A dialogue ends when both participants declare the same closing state. The application also ends it when the message limit is reached or when loop health (ADR 0009) detects circling without progress; it then marks the dialogue `stopped` and surfaces its state to the user.
- A message reaches another agent only as an Invocation context source of a new kind, **agent-authored**, with trust "no authority". Agent messages never approve, never relay human approval, and never move canonical state (ADR 0007, ADR 0011 authority unchanged).
- A converged outcome becomes a typed proposal (options, a Run amendment proposal, or a decision proposal) that only the user approves.
- The approved Delegation plan declares which agent pairs may talk and their limits (an ADR 0011 proposal input). Declared pairs open dialogues on their own; any other dialogue needs the Forger's admission within budget.
- Dialogue is shown in its own thread in the Run overview, styled differently from the user's Conversation. Only an outcome that needs the user reaches Conversation or Attention, linking to the thread. The user may write into a thread at any time; the message is marked human and delivered on each agent's next turn without interrupting one mid-turn. The user may stop a dialogue. Agent messages never enter or alter the user's composer.
- Dialogue arrives in phases. Phase 1 is inside one Run, under the Forger. Phase 2 is across Waypoints, between Forgers coordinated by the Supervisor; Forgers of different Waypoints never talk directly.

### Budgets

- Dialogue inside a Run draws on that Run's budget, in the existing units: tokens, turns, time and plan utilisation in subscription mode, plus money in API mode (ADR 0009 Amendment 1). Each dialogue has its own limit; exceeding it creates one Attention item asking for authorisation, and no further message is sent before the user answers.
- Cross-Waypoint dialogue (phase 2) draws on a **Supervisor coordination budget** that the user approves, separate from Run budgets.

### Plan changes discussed by agents (amends ADR 0011)

- While agents discuss a plan change and no Run amendment proposal exists yet, only the affected tasks stop at a safe checkpoint; the rest of the Run continues.
- Once a Run amendment proposal is submitted, ADR 0011 applies unchanged: dispatch closes until the user decides.
- If the agents do not agree, they bring the conflicting positions, each side's arguments and a recommendation.

### Review rounds (amends ADR 0014)

- Review fix rounds default to two, as a visible proposal value in the Run approval view. When serious findings remain after the last approved round, the application proposes a third or fourth round in Attention with the reason and estimated cost, as a Run amendment the user approves. Minor-only findings never trigger an extra round.

### Provisional defaults

ADR 0009 leaves numeric defaults to measured Evidence. Until measurements exist, the following values apply. They come from the coordinator's own multi-agent sessions (2026-10-08/09) and are marked "provisional (coordinator experience)" in the Project profile, visible, editable, and recalibrated from real use:

| Setting | Provisional default | Observation |
| --- | --- | --- |
| Messages per agent per dialogue | 6, then `needs-human` | Design topics converged in 2-4 exchanges per side, never more than 6 |
| Subjects per dialogue | 1 | Useful dialogues handled one topic at a time |
| Review fix rounds | 2 | C1-0, C1 S1 and the C1 design each needed exactly two |
| Budget warning | 80% | Matches the plan-usage warning level |

`needs-human` is an expected outcome, not an error: almost every observed dialogue needed at least one human decision.

## Consequences

- Execution owns a new agent-dialogue record family (dialogues, messages, envelopes, closing states, per-dialogue budget slices) and a new Invocation context source kind.
- The Delegation plan proposal gains declared dialogue pairs and limits; the Run approval view shows them.
- PRODUCT.md already permits mediated agent dialogue (the parallel-Workers bullet); CONTEXT.md defines Forger, Supervisor, Worker family and agent dialogue.
- A rename slice later migrates code identifiers from "Waypoint parent" to "Forger".
- Supervisor coordination budgets need Settings and Project-profile surfaces.

## Rejected Alternatives

- Free direct chat between agents: it breaks isolation, attribution and replay.
- Pure free text without an envelope: the application could not tell when a dialogue ended or was circling, against the mandatory cost limit.
- A separate Conversation agent and Supervisor: an extra hand-off for the user with no gain.
- A Supervisor that starts Runs on its own: it removes the user's Begin authority.
- Splitting cross-Waypoint dialogue costs across Runs: harder to predict than a single coordination budget.
- No defaults until measured: every dialogue would ask the user for a value; replaced by visible provisional defaults from coordinator experience.

## References

- ADR 0007, ADR 0009 (and Amendment 1), ADR 0011, ADR 0014, ADR 0015
- PRODUCT.md (parallel-Workers bullet, Conversation and Attention rules)
- GitHub #99, #100

## Amendment 1: Phase 2 Cross-Waypoint Dialogue

- Status: Accepted (2026-10-16)
- Date: 2026-10-16
- Decision owners: Pedro Mesquita
- Issue: [#99](https://github.com/TheMastermindPT/slopstop/issues/99)
- Design: `.rpiv/artifacts/designs/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness.md` (Architecture A, C, D; G1-G5, G13, G15)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §90-§98

Line references in this amendment (`:N`) point to the text of this ADR as accepted before the amendment (commit `1b2256a`). Every decision above stays in force except where a rule below names the sentence it relaxes, narrows or replaces.

### Amendment Context

Everything that exists before this amendment is owned by one Run: the policy epoch, the proposal, the Control request, the budget, the Invocation context record, the Model attempt and the `run-worker` Effect. Phase 2 dialogue (the Note of 2026-10-10, :20) is the first thing that spans Runs. This amendment keeps Run-owned authority and adds only non-authoritative links across Runs (a Project-keyed dialogue record and, through ADR 0011 Amendment 1, a joint amendment set), two new budget owners, and one Run-absent invocation family for the Supervisor and the Run-absent read-only Project agent.

### Sentences This Amendment Changes

- :20 (Note of 2026-10-10, "Its mechanics across Runs at different epochs are left to design"): closed by this amendment.
- :34 stays literally true: the Supervisor never changes files, approves anything, or starts a Run. Added: for a proxy answer (below) and for a decision follow-up map revision (ADR 0022 Amendment 1), the user's approval of the typed proposal is the "yes"; no separate Frame is needed. The proposal is anchored to exact revision ids (ADR 0022:28; ADR 0012:149).
- :35 and :37 get a clarifying note only: reviewer and reader Workers inside Runs are unchanged. The Run-absent read-only Project agent below is not a Worker.
- :42: the closing envelope gains `agreement-class` (below).
- :43: besides the message limit and loop health, the application may end a dialogue `stopped` with a named application end reason (below). It never sets an agent's closing state.
- :45: a converged outcome still becomes a typed proposal that only the user approves, with one exception: a **technical agreement** (below) needs no approval. The typed proposal kinds gain the change-Run proposal (below), the joint amendment set (ADR 0011 Amendment 1) and the decision follow-up proposal (ADR 0022 Amendment 1).
- :46 applies to phase 1 dialogues inside one Run. Phase 2 admission follows "Linked pairs and admission" below.
- :48 is **narrowed**: Forgers of different Waypoints still never talk directly. "Through the Supervisor" means that the Supervisor coordinates by recording each dialogue's admission, routing every message (one application routing event per message) and acting as proxy for a side without a Run. A proxy dialogue (a Forger with the Supervisor) is a phase 2 dialogue that is not between two Forgers.
- :53 and the rejected alternative at :92 are replaced by "Coordination budgets" below: there is no single Supervisor coordination budget.
- :57-58: while agents discuss a plan change, only affected tasks stop (unchanged). For a plan-changing cross-Waypoint agreement, the submitted proposal is a joint component under ADR 0011 Amendment 1, which closes dispatch only for held tasks. Single-Run amendments, including those from a phase 1 dialogue, keep ADR 0011 unchanged as :58 states. The joint-only scope is provisional: see the label in ADR 0011 Amendment 1.
- :80 and :84: see "Records" and "Coordination budgets" below.

### Dialogue Shape

- A phase 2 dialogue is **one pair between two Waypoint sides**. A side is that Waypoint's Forger when the Waypoint has a nonterminal Run; otherwise it is the Supervisor as **proxy** for that Waypoint.
- Admission, routing, stop and hand-over are application-recorded thread events, not messages, so a dialogue keeps exactly two message authors (:17) and closes by the existing rule (:43).
- **Agreement class.** The closing envelope gains `agreement-class: technical | plan-changing`, declared by each side with its closing state. If either side declares `plan-changing`, the agreement is `plan-changing`.
- **Application end reasons.** The application may end a dialogue `stopped` with exactly one named reason: `counterpart-run-started`, `counterpart-run-ended`, `hold-time-limit-reached` or `budget-left-unchanged`, in addition to the message limit and loop health of :43. These are application outcomes; the agents' closing states are never written for them.

### Technical Agreement

- An agreement is `technical` only when all of these hold; otherwise it is `plan-changing`:
  - no new, removed or changed task, dependency, order or fan-out;
  - no change to any node-fingerprint input of ADR 0011:91: role, purpose, contract-clause links, result schema, model-selection rule, Project-profile requirements, tool schema hashes, effect scopes, workspace or input requirement, budget and limit allocations, risk class, approval requirements, completion handoff;
  - no changed Behavior, Test, Completion or Waypoint revision (ADR 0011:84);
  - no added power (ADR 0011:174);
  - no contradiction of a current accepted decision revision and no need for a new decision (ADR 0022:21-22).
- Doubt resolves to `plan-changing`. An agreement that changes a task contract or result schema, or contradicts an accepted decision revision, is always `plan-changing`.
- The technical-agreement entry is immutable. It records, for each involved Run, the exact accepted `DelegationTaskId`s that Run's own Forger named as touched by the agreement, and that Run's current policy epoch.
- Until the open storage question below is answered, the canonical writes are the dialogue messages, the closing states and this entry. The agreement reaches agents only as agent-authored, no-authority context (:44) in **new** Sealed Invocations of the **involved Runs**, including their later epochs (ADR 0009:129; ADR 0009 Amendment 1). A joint approval's classification carries it. It never reaches other Runs.
- A technical agreement creates no Attention item and no Decisions-page entry. It is visible in the dialogue thread. :44 stays literally true: the agreement grants no authority and moves no canonical state.

### Contest

- The user may **Contest** a technical agreement. Contest is an immutable contest record linked to the entry; the entry is never edited. `contested` is derived from the latest contest record that has no later withdrawal record.
- Contest appends a human message (:47), places a task hold (ADR 0011 Amendment 1) on the entry's recorded tasks, each mapped to the current plan by id, and opens a new dialogue in the same thread with the same payer. A recorded task that is no longer in the current plan is reported in the thread, never silently dropped.
- A `contested` agreement is excluded from new Sealed Invocations.
- A Contest hold has exactly two user-visible release paths: the new dialogue closes with a **technical** `agreement` (`released-on-technical-agreement`), or the user chooses **Withdraw contest** (`released-on-contest-withdrawn`), which writes an immutable withdrawal record and returns the agreement to new seals. A **plan-changing** re-agreement follows the joint-set rows of the hold lifecycle in ADR 0011 Amendment 1, and the end of the held task's Run releases a Contest hold with `released-on-run-end` (decisions log §97, K5).
- A `no-agreement`, `needs-human` or `stopped` close keeps the Contest hold and raises one Attention row whose only release control is "Withdraw contest". "Release held tasks" never applies to a Contest hold, and a Contest hold is not time-limited.

### Linked Pairs And Admission

- A pair is **linked** when a current, non-archived `blocks` relationship (either direction) or `related-to` relationship joins the two Waypoints (ADR 0006:84-85). `derived-from` is excluded.
- A linked pair opens a dialogue without a user prompt, through a recorded `map-link` admission that pins the relationship id and revision.
- Before each send the application re-checks that relationship. If it is no longer current, the next message is held with `DIALOGUE_ADMISSION_CHANGED` until a recorded Supervisor re-admission or a stop. The wait is bounded by the held-task time limit (ADR 0011 Amendment 1). The word `changed` here is dialogue-owned vocabulary for a lapsed admission; it mirrors, but does not take its authority from, ADR 0011:183.
- Any other pair needs a recorded `supervisor-admission`, visible in the thread. A Supervisor admission is not a user action; the user may stop the dialogue.

### Hand-Over

- If the proxy side's Waypoint gains a Run while a dialogue is **in progress** (its Run slot moves from vacant to occupied, ADR 0007:31-32), the application ends the proxy dialogue `stopped` (`counterpart-run-started`) and opens a new dialogue with that Run's Forger in the same thread, with the prior messages as agent-authored context.
- The mirror case, a side's Run ending while a dialogue is in progress, ends the dialogue `stopped` (`counterpart-run-ended`) and opens a proxy dialogue.
- A hand-over dialogue keeps the original payer, and holds carry over unchanged. This rule applies only to dialogues in progress; a submitted joint set follows ADR 0011 Amendment 1.

### A Waypoint Without A Run: The Supervisor Proxy

- "No active Run" means the Waypoint's Run slot is vacant (ADR 0007:31-32). Any nonterminal Run, in any of its states (ADR 0007:32), is answered by its own Forger. If that Forger is unavailable, the dialogue waits visibly, bounded by the held-task time limit. The same bound applies when the Supervisor proxy itself is unavailable (decisions log §97, K5).
- The proxy answers from canonical records only (Supervisor context, below). It starts nothing (:34, :91; `PRODUCT.md`: "Manual Actions create a Run only through Begin"). A needed change becomes a typed proposal:
  - for a **completed** Waypoint: a typed **change-Run proposal** whose action is the user's `BeginAction` with cause `ACTION_SELECTED` (ADR 0011:125; ADR 0007:43 unchanged; the dialogue is provenance, never a cause). Once that Run's Forger exists, the agreement re-enters as a **two-Run joint set** with that Forger, and any one-Run set closes with the named cause `PREREQUISITE_RUN_STARTED` (a closing, not `changed`). If that Waypoint's Candidate is still awaiting review, the action is the user's Request changes instead (ADR 0015:83). While the proposal waits, its Attention row offers "Begin" or "Decline"; Decline releases the holds that wait on it (ADR 0011 Amendment 1, hold lifecycle);
  - for a Waypoint whose last Run ended `cancelled`, `failed` or `superseded`: a `BeginAction` change-Run proposal with the same re-entry and the same "Begin" or "Decline" row, or a map, decision or contract revision proposal;
  - for a **not-started** Waypoint: a map, decision or contract revision proposal anchored to exact revision ids.
- **Proxy-side agreements use the joint path.** A plan-changing agreement between a Run side and a proxy side becomes a joint amendment set with N = 1 while the proxy's change is a revision proposal, so only the affected tasks stop. That revision proposal is a prerequisite that must settle before the joint approval: a sealed `pending` proposal condition of the joint set (accepted, or `PREREQUISITE_CHANGED` if rejected or superseded), never a task edge, a task input or a new task-input source kind (ADR 0011:203, :249 and ADR 0015:37 unchanged). A change that needs a Run on the proxy side follows the completed-Waypoint sequence above instead.

### Supervisor-Detected Conflicts

- A deterministic coordinator detector runs on epoch activation (ADR 0011:129, :133), on an accepted map revision, and on a meaning-changing decision revision or retirement (the `decision-current-meaning-replaced` event of ADR 0017 Amendment 1; never on a wording-only revision). It compares, across nonterminal Runs, effect scopes (ADR 0011:234), typed resource keys (ADR 0013), contract-clause links (ADR 0011:91), decision implementing links (ADR 0022:22) and map relationships.
- A candidate conflict triggers one Supervisor `conflict-scan` turn, paid by the Project coordination reserve, that decides whether to open a dialogue.
- "Not checked" (`not-run`) and "check failed" (`failed`) stay distinct from "no conflict" and never display as it (ADR 0022:50). Lease-time collisions (`PRODUCT.md`, Run workspace rule) and in-plan independence (ADR 0011:103) are unchanged.

### Run-Absent Invocations

- One **Run-absent invocation family** has two typed arms; this amendment owns the family vocabulary:
  - `supervisor-coordination`, purposes `dialogue-turn | proxy-answer | admission | conflict-scan | decision-follow-up`;
  - `project-agent`, the **Run-absent read-only Project agent**, purposes `foundation-inference | decision-echo-search`. It replaces "a read-only Worker" at ADR 0022:43 for Foundation inference and serves the decision echo search (ADR 0022 Amendment 1). It is not a Worker: no Worker slot, status or Delegation task (ADR 0007:25 unchanged).
- The Project agent has **no tools**. It reads only compiled context (`no-workspace-input`, ADR 0009:40) built by a deterministic observer from an Evidence-owned immutable content Artifact (an `evidence-produced` Artifact) captured by `decision-search-capture` (ADR 0010 note). It has no Run workspace. How a Run-absent governed CLI session is launched, and whether it is a Process job, is decided in issue [#136](https://github.com/TheMastermindPT/slopstop/issues/136) with the C2 CLI work.
- Each Run-absent provider dispatch has exactly one `project-coordination` Effect subject (ADR 0013 Amendment 1) and one `project-coordination` Evidence scope (ADR 0010 note). The Sealed Invocation, Invocation context record and Turn Machine extensions are in the ADR 0009 note.
- Forger turns in a cross-Waypoint dialogue keep the Forger target with purpose `cross-waypoint-dialogue`. Their budget scope is the dialogue's payer, and they stay `run-worker` Effects of their own Run.

### Supervisor Context

The Supervisor's Invocation context record follows one recorded source-selection rule (ADR 0009:50, :58): canonical records only.

- Included: the map; the involved Waypoint and Strand revisions and relationships; every Foundation section (ADR 0022:42) plus the decision revisions scoped to or implemented by the involved Waypoints; accepted contract revisions; each involved Run's accepted plan, fingerprints, effect scopes and approval view; for a completed side, Candidate review, Completion authorization, Integration proof and decision trailers; dialogue messages as agent-authored sources.
- Excluded, each with a recorded reason: repository content and Project conversation messages. The Supervisor never reads code (:34-35).

### Coordination Budgets

- **Owner.** Execution owns a **coordination budget** with the scope union `strand` (a Strand id) or `project-reserve`. It has immutable approved revisions (limits, approval decision, receipt) and a current waterline (consumed, pending) with a warning state. A raise needs a new approved revision; a lower limit applies at once (the live-restriction rule of ADR 0011:173-174). Defaults come from the Project profile (:84; ADR 0006:52).
- **Approval moment.** A Strand's budget is a sealed, separately hashed input of the first Run approval proposal of any Waypoint in that Strand; it appears in the approval view, and rejecting it rejects that approval (ADR 0011 notes). The Project reserve is approved either by that same route in the Project's first Run approval, or earlier through a one-time Attention ask, `ApproveCoordinationReserve` with its own receipt, raised the first time a reserve-paid turn is needed. Onboarding always raises that ask for Foundation inference. A Run approval carries the reserve line only while no approved reserve revision exists.
- **Race rule.** One pending budget proposal exists per Strand, and one for the reserve, under compare-and-set. If two first approvals race, the loser's budget line becomes `changed` with `COORDINATION_BUDGET_PROPOSAL_CHANGED`.
- **Who pays.**

| Turn | Payer |
| --- | --- |
| Forger-requested dialogue (every message, proxy answers, admission turns) | The requesting Strand, pinned at open; the Project reserve while that Strand has no budget yet |
| Hand-over, Contest and re-check dialogues | The original dialogue's payer |
| Supervisor-opened dialogue; conflict scan | Project reserve |
| Project-scope decision search; Foundation inference | Project reserve |
| Waypoint- or Strand-scope decision search | That Strand's budget, or the Project reserve while that Strand has none yet |
| Decision follow-up proposal turn | The payer of its decision's search |

The decision-search entries of this table (not Foundation inference) are provisional: see the label on the two search passes and their funding in ADR 0022 Amendment 1.

- When the reserve itself does not exist yet, the turn is `not-run(budget-missing)` with `COORDINATION_BUDGET_MISSING`, and the one-time Attention ask applies.
- Cross-Waypoint Forger turns never debit a Run. In-Run dialogue stays under :52.
- **Debit.** Turns pin budget scope and a reservation (ADR 0009:43, :108). Validated usage debits the waterline; missing usage is pending, never zero (ADR 0009:101).
- **Units.** Tokens, turns, elapsed time and messages for every mode; plan utilization for subscription-mode turns; a money ceiling for API-mode turns (ADR 0009 Amendment 1). One budget may mix modes.
- **Warning and limit.** The 80% warning shows in the thread and on the budget surface, not in Attention. At the limit, one Attention item per budget (not per dialogue) lists the tasks held by the dialogues it pays for, with "Approve a raise" or "Leave unchanged". Every further message charged to it is refused with `COORDINATION_BUDGET_EXHAUSTED`. The per-dialogue message limit still applies (:18, :43). "Leave unchanged" ends the paid dialogues `stopped` (`budget-left-unchanged`).
- **Reserve at its limit.** No new Supervisor-opened dialogue, conflict scan, Project-scope search, Foundation inference or other reserve-paid turn runs until the user decides.
- **Spent budget rule.** Any user action that starts paid turns records the spend as irreversible. It asks for confirmation only when the payer is at or above its 80% warning.

### Records

- The dialogue family (:80) becomes **Execution-owned and Project-keyed**, `(project_id, dialogue_id)`, with:
  - typed participant arms: `forger` (Run and Forger) and `supervisor-proxy` (Waypoint and the Waypoint revision answered for);
  - an immutable **admission child**: `map-link` or `supervisor-admission`; for phase 1 also `declared-pair` and `forger-admission`, which records the phase 1 admission that :46 required but no record held;
  - a **payer child**, a two-arm union: `coordination-budget` (one coordination budget) for a phase 2 dialogue, or `run-budget` (its own Run, :52) for a phase 1 dialogue;
  - per-message routing events;
  - immutable technical-agreement entries, contest records and withdrawal records.
- Every involved Run overview shows the thread; a proxy side shows it in the Strand view. It is not a Board entry.
- Every new record carries an optional typed **provenance reference** whose union can grow by amendment. Today its only arm is the dialogue closing state. Provenance never enters an authority reference (ADR 0011:44).
- Contest records, withdrawal records, routing events and the diagnostics this amendment owns hold identities, versions and hashes only, never decision text, excerpts or paths.

### Diagnostics

This amendment owns `DIALOGUE_ADMISSION_CHANGED`, `DIALOGUE_ADMISSION_BROKEN`, `COORDINATION_BUDGET_EXHAUSTED`, `COORDINATION_BUDGET_MISSING`, `COORDINATION_BUDGET_PROPOSAL_CHANGED`, `COORDINATION_BUDGET_BROKEN` and `CONFLICT_DETECTOR_BROKEN`, plus the application end reasons above. ADR 0011 Amendment 1 only references them. A broken admission check is `failed` with `DIALOGUE_ADMISSION_BROKEN`, a broken budget lookup with `COORDINATION_BUDGET_BROKEN`, and a broken detector run with `CONFLICT_DETECTOR_BROKEN`; none ever reads as "admitted", "within budget" or "no conflict".

### Provisional Defaults (Added Rows)

The table at :69-74 gains these rows. Their numbers stay open until measured Evidence or a user value exists (ADR 0009:163):

| Setting | Provisional default | Observation |
| --- | --- | --- |
| Strand coordination budget | open | Approved in the first Run approval of the Strand |
| Project coordination reserve | open | Approved once (first Run approval or the one-time ask) |
| Held-task time limit | open | One elapsed-time limit for every hold that waits on others (ADR 0011 Amendment 1) |

### User Actions And Their Undo

Every user action this amendment introduces or changes can be undone, or records why not and asks for confirmation first (decisions log §93, §94 R8). A reversal never rewrites history: it is a new recorded action or revision.

| User action | Undo or reversal (where it lives) | Not reversible (reason), confirm first |
| --- | --- | --- |
| Contest a technical agreement | "Withdraw contest" (thread) | The appended message and spent budget cannot be undone; confirm |
| "Withdraw contest" | Contest again (thread) | Held tasks resume and may start; seals made while uncontested include the agreement; confirm, naming the tasks |
| Stop a cross-Waypoint dialogue (:47) | Open a new dialogue in the same thread (thread) | The closed dialogue and spent budget stay; holds stay until released; confirm |
| Write a human message into a cross-Waypoint thread | None | The message is immutable and starts paid Forger turns (spent budget rule); no confirmation below the warning |
| Approve a coordination budget, the reserve, or a raise | A new revision with lower limits applies at once (budget surface) | Usage already spent is not refunded; confirm when raising |
| "Leave unchanged" at a budget limit | "Approve a raise" (budget surface) | The paid dialogues end `stopped`; confirm |
| Accept a map revision that changes relationships of an open dialogue | A new map revision restores the link (map view) | The admission does not come back (a new relationship revision); stalled dialogues and a paid conflict scan follow; confirm, naming the dialogues |
| Supervisor admission of an unlinked pair | Not a user action; the user can stop the dialogue (row above) | None |

The hold, joint-proposal and change-Run actions are listed in ADR 0011 Amendment 1; the decision actions in ADR 0022 Amendment 1.

### Kept Open

- Where technical agreements are stored for future Runs, and whether Runs other than the involved ones receive them, stays open (FRD Open Question 1; design G13). No text here chooses a storage, makes the provenance arm authoritative, or delivers technical agreements beyond the involved Runs. A new interface record would need its own owner, source-selection rule (like ADR 0022:34) and the same meaning-version, event and echo pattern as decisions; storing agreements as Decisions would need a flag keeping them off the Decisions page and Attention, and conflicts with "no approval"; Verified Memory would need an Evidence member (ADR 0017 Amendment 1).
- The numbers in "Provisional Defaults" stay open.

### Amendment Consequences

- Cross-Waypoint coordination never discards work and never stops unrelated work: only affected tasks are held, and only by an attributed source.
- Execution gains a Project-keyed dialogue family and a coordination-budget family; Settings and the Project profile gain the Strand budget and Project reserve surfaces.
- The Supervisor and the Project agent become Run-absent provider callers with their own Effect subject and Evidence scope; they still approve nothing, begin nothing and, for the Supervisor, read no code.

### Amendment Rejected Alternatives

- Two pairs through the Supervisor: no rule joins two closings into one agreement, and relaying loses attribution (:42).
- A single Supervisor coordination budget (:53, :92): it hides which Strand caused a cost.
- A Strand revision child or the Project profile as budget authority: neither is an approved budget owner.
- Conversation turns or hosting Supervisor turns in the requesting Run: Conversation records are not invocation contracts (ADR 0009:48), and a Run cannot pay for coordination it does not own.
