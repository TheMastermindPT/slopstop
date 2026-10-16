---
date: 2026-10-16T16:32:45+0100
author: Pedro Mesquita
commit: 7919161
branch: main
repository: slopstop
topic: "Cross-Waypoint agent dialogue (phase 2) and decision-dependent staleness of memories and documents"
tags: [intent, frd, agents, supervisor, forger, dialogue, runs, budget, decisions, memory, attention]
status: complete
register: mixed
consensus: confirmed
lane: rigorous
lane_reasons: ["sensitive area: authority and approval boundaries (ADR 0011 amendments, ADR 0017 trusted memory, ADR 0021 dialogue)", "lane.mjs not run: no files named at intent time (contracts are ADR-only; Runs are not built)"]
last_updated: 2026-10-16T16:32:45+0100
last_updated_by: Pedro Mesquita
issue: https://github.com/TheMastermindPT/slopstop/issues/99
content_hash: 7f749f754a8e82abbddbd3355e7f9b4621faced49ad3e93ac9f12083d04aaee5
---

# FRD: Cross-Waypoint agent dialogue (phase 2) and decision-dependent staleness

## Summary
This continues the #99 interview. Two topics were settled.

**Phase 2 dialogue.** When Waypoints that run in parallel need to agree, their Forgers talk through the Supervisor. Only the affected tasks pause. A purely technical agreement inside the approved plans needs no user approval. An agreement that changes plans becomes one joint proposal for all affected Runs. The proposal goes stale if a Run's plan version changes. The Strand's coordination budget pays for the dialogue.

**Decision changes.** A Verified Memory may depend on an accepted decision, so a replaced or retired decision makes it stale. Documents that repeat a decision are tracked by links and by a search when the decision changes. The user then gets one Attention item with everything affected and a proposed update.

## Problem & Intent
Phase 2: all three situations count. Two parallel Waypoints must agree on something shared (an API, a format, a name). A discovery in one Waypoint forces a change in another. Waypoints wait on each other, or argue about who does what first. Example: in MaxReps, the API Waypoint and the screen Waypoint agree on the data format.

The failures the user most wants to avoid:
- "Trabalho deitado fora": a Waypoint keeps working on an interface or plan that the other has already changed.
- "Tudo parado": a dialogue blocks Waypoints that have nothing to do with it.

The user does not want to approve technical details: "eu nao acho que va ser importante eu ter que decidir um nome de um campo". Cost: "eu nao estou muito preocupado com o gasto mas nao custa nada salvaguardar".

Decision staleness (the user put it on the agenda on 2026-10-11). The user chose all three problems:
- agents working from a memory based on a decision that has changed;
- PRODUCT.md, ADRs or AGENTS.md still stating the old version;
- not knowing what to update when a decision changes.

## Goals
- Parallel Waypoints settle shared interfaces, cross-Waypoint changes and ordering conflicts without discarding work.
- A cross-Waypoint dialogue pauses only the affected tasks; everything else keeps running.
- The user approves only what changes plans, never technical details inside approved scope.
- No memory based on an outdated decision reaches an agent.
- When a decision changes, the user sees everything that depends on it or repeats it, and gets a proposed update.

## Non-Goals
- Direct Forger-to-Forger dialogue across Waypoints (ADR 0021:48 kept).
- Agent messages with any authority, or agreements that change a Run without the user's approval (ADR 0021:44-45, ADR 0011:131 kept).
- The user deciding technical details (field names and the like) inside approved scope.
- Where technical agreements are stored long-term (deferred; see Open Questions).
- Copying decisions into Verified Memory (PRODUCT.md rule, ADR 0022:44 kept).

## Functional Requirements
1. Several Waypoints SHALL run in parallel, each with at most one nonterminal Run (kept; ADR 0007:31, PRODUCT.md:109).
2. Forgers of Waypoints linked on the map by `blocks` or `related-to` SHALL be allowed to open a cross-Waypoint dialogue through the Supervisor, within the coordination budget. Any other pair SHALL need the Supervisor's admission, visible in the dialogue thread.
3. A cross-Waypoint dialogue SHALL be opened when a Forger asks the Supervisor, or by the Supervisor when it detects a conflict (for example two plans touching the same thing).
4. During a cross-Waypoint dialogue, only the affected tasks of each involved Run SHALL stop at a safe checkpoint. The rest of those Runs and all other Waypoints SHALL continue (the phase 1 rule of ADR 0021:57 applied to several Runs).
5. A purely technical agreement that stays within every involved Run's approved plan (no new tasks, order, scope, budget or power; ADR 0011:172-174) SHALL take effect without a user approval. It SHALL stay recorded and visible in the dialogue thread, where the user can contest it.
6. An agreement that changes any involved Run's plan SHALL become one joint proposal covering every affected Run, shown as one Attention item and approved or rejected as a whole.
7. A joint proposal SHALL record the policy epoch of every Run it covers. If any of those Runs gets a new epoch or ends before the user decides, the proposal SHALL be marked stale and SHALL NOT be approvable. The Forgers then re-check it against the new state and propose again.
8. When the other Waypoint has no active Run (not started, or finished), the Supervisor SHALL answer for it from that Waypoint's accepted work and decisions. A needed change to a finished Waypoint SHALL become a proposal for a change Run, which the user approves.
9. The Supervisor coordination budget SHALL be approved per Strand when that Strand's work starts. It SHALL pay every cross-Waypoint message, including the Forgers' dialogue turns. It SHALL warn at 80%, and at its limit SHALL create one Attention item, with no further message sent until the user decides.
10. A dialogue between Waypoints of different Strands SHALL be paid from the coordination budget of the Strand whose Forger asked for it.
11. An accepted decision revision SHALL be allowed as a mandatory dependency of a Verified Memory revision, alongside Evidence (amends ADR 0017:47-63).
12. When a decision a memory depends on gets a new current revision or is retired, that memory revision SHALL become stale immediately and stop reaching agents until it is re-verified as a new revision (the ADR 0017 stale rules apply).
13. When an agent writes a decision into a Project repository document, Ragnarok SHALL record a link "this document repeats this decision" (document and location).
14. When a decision changes or is retired, a read-only Worker SHALL search the Project repository for text that repeats it without a link, and report candidates.
15. When a decision changes or is retired, Attention SHALL show one item listing the stale memories, the linked and found documents, and the Runs pinned to the old revision (ADR 0022:49). The Supervisor SHALL propose the update work (updating documents, re-verifying memories), which the user approves before anything changes.
16. When editing a decision, the user SHALL be able to mark the change "wording only, meaning unchanged". Such a revision SHALL NOT make dependent memories or documents stale, and the mark SHALL stay in the decision's history. Only the user can set it.
17. A retired decision SHALL be handled like a replaced one (requirements 12-15).

## Non-Functional Requirements
- **Performance**: no specific constraint. Cost is guarded by the per-Strand coordination budget; the user is not worried about cost, but wants the guard.
- **Security**: agent messages stay untrusted text with no authority. Agreements never relay approval. The "wording only" mark is user-only.
- **UX / Accessibility**: technical agreements stay in the dialogue thread, never in Attention or the Decisions page. Attention gets only plan-changing joint proposals, budget limits and decision-change lists.
- **Reliability**: a stale joint proposal is a distinct, visible state, never silently applied. A memory is effectively stale at read time, even before asynchronous settlement (ADR 0017:89).

## Constraints & Assumptions
- Runs, the Supervisor and agent dialogue are not built yet. The contracts live in ADRs 0007, 0009, 0011, 0015, 0017, 0021 and 0022.
- Gaps found in the ADRs during the probe:
  - no rule says which tasks count as "affected", and no command pauses a Worker (only stop or Run pause);
  - no relationship type defined "linked Waypoints" (now decided: `blocks` and `related-to`);
  - no artifact for a shared interface between Waypoints exists;
  - no rule covers a running Run when the map changes;
  - no Attention item exists for conflicts between two Waypoints' Runs.
- Assumption, confirmed in teach-back: the Forger classifies an agreement as technical or plan-changing. A wrong classification is bounded, because a Forger cannot add tasks, change order or spend more without an amendment the user approves (ADR 0011:131, :172-174).
- Assumption, confirmed: the documents tracked are the user's Project repository documents. This is the work the coordinator does by hand today in slopstop.

## Acceptance Criteria
- [ ] With two Runs on Waypoints linked by `related-to`, a Forger's request opens a dialogue through the Supervisor without a user prompt. An unlinked pair shows "admitted by the Supervisor" in the thread first.
- [ ] During a cross-Waypoint dialogue, only the tasks named as affected show "paused at safe point". Other tasks in both Runs and every other Waypoint keep running.
- [ ] A technical agreement inside both approved plans creates no Attention item and appears in the dialogue thread.
- [ ] A plan-changing agreement creates exactly one Attention item covering both Runs, and approving it changes both Runs' plans together. Rejecting it changes neither.
- [ ] Approving another amendment on one of the two Runs while the joint proposal waits marks the joint proposal stale and disables its approval.
- [ ] A dialogue with a finished Waypoint is answered by the Supervisor, and any needed change appears as a change-Run proposal.
- [ ] Coordination spending is charged to the requesting Strand. At 80% a warning appears; at the limit one Attention item appears and no further message is sent.
- [ ] Replacing or retiring a decision makes every dependent memory revision excluded from trusted retrieval at once, and Attention lists those memories, the linked and found documents and the pinned Runs, with a proposed update.
- [ ] A decision edit marked "wording only" leaves dependent memories trusted and documents unflagged, and the mark appears in the decision history.

## Recommended Approach
Design an amendment to ADR 0021 (phase 2 mechanics: linked-pair rule, Supervisor-opened dialogues, affected-task pause across Runs, technical versus plan-changing agreements, joint proposals bound to every covered Run's epoch, Supervisor proxy for Waypoints without a Run, per-Strand coordination budget). Also amend ADR 0011, for a multi-Run joint amendment with a staleness check, and ADR 0017, for decision revisions as mandatory memory dependencies. Add a decision-echo link record with a change-time search, and one decision-change Attention item.

## Decisions

### Phase 2 situations
**Question**: Which real situation of cross-Waypoint dialogue matters, and what must go right?
**Recommended**: n/a — `intent` question
**Chosen**: All three: agreeing an interface, one Waypoint's change affecting another, ordering and dependencies.
**Rationale**: The user's own selection.

### Phase 2 failures to avoid
**Question**: What would be a failure of phase 2?
**Recommended**: n/a — `intent` follow-up
**Chosen**: Work thrown away; everything stopped.
**Rationale**: The user's own selection. Cost and "being left out" were not chosen; ADR 0021 already guards them.

### Parallel Waypoints
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep.
**Chosen**: Keep: one active Run per Waypoint, Waypoints in parallel.
**Rationale**: evidence: docs/adr/0007-supervised-execution-aggregate-ownership.md:31, PRODUCT.md:109 + confirmed.

### Forgers talk only through the Supervisor
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep.
**Chosen**: Keep.
**Rationale**: evidence: docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md:48 + confirmed.

### Runs stay pinned to the approved plan
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep.
**Chosen**: Keep: a running Run changes only through an amendment the user approves.
**Rationale**: evidence: docs/adr/0011-approved-run-preparation-and-amendment-authority.md:46, :131 + confirmed.

### No authority in agent messages across Waypoints
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep.
**Chosen**: Keep.
**Rationale**: evidence: docs/adr/0021-supervisor-forger-and-mediated-agent-dialogue.md:44-45 + confirmed.

### Who may talk
**Question**: Who decides that two Waypoints may talk?
**Recommended**: Map links plus Supervisor admission.
**Chosen**: Waypoints linked by `blocks` or `related-to` talk directly through the Supervisor; any other pair needs the Supervisor's visible admission.
**Rationale**: The map already says what is linked, and the user does not approve each pair (evidence: docs/adr/0006-physical-persistence-layout.md:84-85).

### What stops during a dialogue
**Question**: While two Forgers discuss a change, what stops?
**Recommended**: Only the affected tasks.
**Chosen**: Only the affected tasks of each involved Run, at a safe checkpoint.
**Rationale**: It answers the "tudo parado" failure and reuses the phase 1 rule (ADR 0021:57).

### Approval of a cross-Waypoint agreement
**Question**: How does an agreement that changes two Runs reach the user?
**Recommended**: One joint proposal.
**Chosen**: One joint proposal, approved or rejected as a whole.
**Rationale**: One Run is never changed without the other, which answers the "trabalho deitado fora" failure.

### Technical agreements need no approval
**Question**: Should a technical agreement inside the approved plans need the user's approval? (asked after the user's correction)
**Recommended**: No, only plan-changing agreements.
**Chosen**: Only plan-changing agreements reach the user; technical agreements stay recorded and visible in the thread.
**Rationale**: The user's words: "eu nao acho que va ser importante eu ter que decidir um nome de um campo"; consistent with ADR 0011:172-174.

### Waypoint without an active Run
**Question**: What if the other Waypoint has no active Run?
**Recommended**: The Supervisor answers for it.
**Chosen**: The Supervisor answers from that Waypoint's accepted work; a change to a finished Waypoint becomes a change-Run proposal.
**Rationale**: The requesting Run does not wait for an agent that does not exist.

### Epoch change while a joint proposal waits
**Question**: What happens to a waiting joint proposal if one Run changes plan version or ends?
**Recommended**: It goes stale and is re-checked.
**Chosen**: It goes stale, cannot be approved, and is re-checked and proposed again.
**Rationale**: An agreement made against a plan that no longer exists is never applied.

### Coordination budget granularity
**Question**: When, and for what, is the Supervisor coordination budget approved?
**Recommended**: Per Strand.
**Chosen**: Per Strand, warning at 80%, Attention at the limit.
**Rationale**: It follows meaningful units of work (evidence: ADR 0021:53).

### Cross-Strand dialogue cost
**Question**: Which budget pays a dialogue between Waypoints of different Strands?
**Recommended**: The requesting Strand's.
**Chosen**: The requesting Strand's.
**Rationale**: The user's words: "nao estou muito preocupado com o gasto mas nao custa nada salvaguardar".

### Who opens a cross-Waypoint dialogue
**Question**: Who can start a dialogue between Waypoints?
**Recommended**: A Forger asks, or the Supervisor on a detected conflict.
**Chosen**: A Forger asks, or the Supervisor on a detected conflict.
**Rationale**: Catches conflicts early.

### Memories depending on decisions
**Question**: When a decision is replaced, what happens to memories that rely on it?
**Recommended**: They become stale.
**Chosen**: They become stale: a decision revision may be a mandatory memory dependency (amends ADR 0017).
**Rationale**: An agent never receives a memory based on an outdated decision.

### Documents that repeat a decision
**Question**: How does Ragnarok know which documents repeat a decision?
**Recommended**: Recorded links plus a change-time search.
**Chosen**: Recorded links plus a change-time search.
**Rationale**: It catches both agent-written and hand-written copies (related: ADR 0022:60 commit trailers).

### What happens when a decision changes
**Question**: What should the user see, and what happens next?
**Recommended**: A list plus a proposed update.
**Chosen**: One Attention item with stale memories, documents and pinned Runs; the Supervisor proposes the update work; the user approves.
**Rationale**: The user does not hunt for dependents by hand.

### Wording-only edits
**Question**: Should a typo fix make dependent memories stale?
**Recommended**: The user can mark "wording only".
**Chosen**: The user can mark "wording only"; without the mark, everything dependent becomes stale.
**Rationale**: A typo creates no useless work; the mark stays in history and is user-only (teach-back).

### Retired decisions
**Question**: And a decision retired without a replacement?
**Recommended**: Same as replaced.
**Chosen**: Same as replaced.
**Rationale**: Consistent handling.

## Open Questions
- Where technical agreements between Waypoints are stored for future Runs. The user leans to a new interface record, separate from Decisions, and does not want technical details mixed with decisions: "talvez um registo nove de interface mas tenho que pensar bem".
- How a Forger names the affected tasks, and which command pauses a Worker at a safe checkpoint (no Worker-pause command exists; ADR 0007:58, ADR 0009:118-121). For design.
- Numeric defaults for the per-Strand coordination budget (evidence-driven; ADR 0009:163).

## Suggested Follow-ups
- A rule for a running Run when the map changes (gap: only decision edits are covered, ADR 0022:48-49).
- An Attention item type for conflicts between two Waypoints' Runs (gap in PRODUCT.md:48 and ADR 0021).
- Two Runs touching the same code: no rule beyond exclusive mutation leases (PRODUCT.md:110; ADR 0008:105).

## Glossary
| Term | What it means here |
|---|---|
| Phase 2 | Conversation between agents of different Waypoints, through the Supervisor. |
| Forger | The agent that leads one Run of a Waypoint. |
| Supervisor | The agent above the Runs that plans and coordinates; it never approves or executes. |
| Run (corrida) | One execution of a Waypoint's plan. |
| Epoch (época) | The version of a Run's approved plan; it changes only when the user approves an amendment. |
| Safe checkpoint (ponto seguro) | A moment where a task can stop without leaving work half-done. |
| Joint proposal (proposta conjunta) | One proposal that changes several Runs together, approved or rejected as a whole. |
| Technical agreement (acordo técnico) | An agreement inside the approved plans, such as a field name; it needs no approval. |
| Coordination budget | The Supervisor's budget for conversations between Waypoints, approved per Strand. |
| Mandatory dependency | Something a memory relies on; if it changes, the memory becomes stale. |
| Stale (desatualizada) | A memory that no longer reaches agents until it is confirmed again. |
| Wording only (só redação) | A decision edit that fixes text without changing its meaning. |

## Shared Understanding
**Agreed model (in the developer's words):**
- **Phase 2.** A Strand has a coordination budget the user approves. The Supervisor opens the dialogue, when a Forger asks or when it sees a conflict, between Forger A and Forger B. Only the affected tasks pause and the rest continues. A technical agreement inside the plans is recorded without asking. An agreement that changes plans becomes one joint proposal for both Runs. If a Run changes plan version, the proposal goes stale and is revised. Linked Waypoints talk at once; other pairs need the Supervisor's admission. A Waypoint without a Run is answered by the Supervisor. A cross-Strand dialogue is paid by the requesting Strand.
- **Decision staleness.** Memories that rely on a decision become stale when it changes or is retired. Documents are tracked by links, plus a search. One Attention item lists everything, and the Supervisor proposes the update. A "wording only" edit changes nothing downstream.

**Corrected during teach-back:** nothing. One correction came earlier in the interview: the user does not want to approve technical details, which produced the technical versus plan-changing split.

**Residual uncertainty (accepted):**
- The Forger classifies agreements; a wrong classification is bounded by the amendment authority.
- Technical agreements are visible and contestable in the thread.
- Only the user can set "wording only".
- The tracked documents are the Project's repository documents.

## References
- `.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md` (:187-189 open questions)
- `.rpiv/artifacts/discover/2026-10-10_00-59-10_v1-scope-deferred-decisions.md` (phase 2 in v1)
- `.rpiv/artifacts/research/2026-10-10_pending-work-roadmap.md:47`
- `docs/adr/0006-physical-persistence-layout.md:82-86`, `0007-supervised-execution-aggregate-ownership.md:31, :43, :58, :106`, `0009-provider-neutral-agent-runtime-and-turn-contracts.md:118-121, :163`, `0011-approved-run-preparation-and-amendment-authority.md:22-23, :46, :84, :128-133, :172-174`, `0015-parallel-worker-candidate-composition-and-exact-integration.md:37`, `0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:47-63, :89`, `0021-supervisor-forger-and-mediated-agent-dialogue.md`, `0022-decision-scope-and-implementing-waypoints.md`
- `PRODUCT.md:48, :109, :110`
- GitHub #99, #114
