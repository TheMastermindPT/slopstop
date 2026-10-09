---
date: 2026-10-09T18:03:55+0100
author: Pedro Mesquita
commit: 3895d4a
branch: main
repository: slopstop
topic: "Agent coordination: Supervisor, Forger, Worker families and application-mediated agent dialogue"
tags: [intent, frd, agents, supervisor, forger, dialogue, runs, attention, budget]
status: complete
register: mixed
consensus: confirmed
lane: rigorous
lane_reasons: ["sensitive area: authority and approval boundaries (PRODUCT.md parallel-Workers rule, ADR 0007/0009/0011/0014/0015)", "lane.mjs not run: no files named at intent time"]
last_updated: 2026-10-09T18:03:55+0100
last_updated_by: Pedro Mesquita
issue: https://github.com/TheMastermindPT/slopstop/issues/99
content_hash: 13a4d7f53edd5b754aabc880fb95207258b40d0138b9e2f1bb60202c667b5297
---

# FRD: Agent coordination and application-mediated agent dialogue

## Summary
Ragnarok gains three agent levels:
- a **Supervisor**, which plans and coordinates across Waypoints but never executes or approves;
- a **Forger** per Run (the renamed Waypoint parent), which splits and merges work and proposes plan changes;
- **Workers** in two families: doers that change files, and readers that research or review.

Agents talk to each other only through an application-mediated dialogue: free text with a minimal envelope, budgeted from the Run, shown in its own thread and never authoritative. Whatever they agree becomes a proposal that the user decides. Dialogue arrives in phases: first inside a Run, then across Waypoints through the Supervisor.

## Problem & Intent
In the user's words: "A segunda coisa que teremos que falar É sobre a coordenação de agentes, mas em termos de os agentes poderem comunicar uns com os outros. Em relação ao design, nas janelas de conversa, se tiver que ser, iremos ver de maneira destacada que mensagens são de agentes para agentes e quais são as da conversa natural entre o humano e a máquina. … O meu receio é que haja demasiado gasto de chamadas para o modelo quando eles têm que conversar. … da maneira atual o que está a ocorrer é que, por exemplo, estou a escrever um prompt e outro agente está a escrever um prompt. Ao mesmo tempo as mensagens ficam coladas umas com as outras."

The user chose all of these intents together: less coordination done by the user, better results when agents with different roles talk, and large requests split across many agents. Earlier in the session: "ao fazer um pedido a um agente (neste caso seria o supervisor …) a tarefa vai ser repartida por vários waypoints … Se estes agentes tiverem uma tarefa nas quais podem colaborar, então eles aí falam." The motivating experience was this session's peer dialogue between the coordinator and the design agents.

## Goals
- The user coordinates less: agents resolve what they can between themselves and bring only what needs the user.
- Agents with different roles reach better solutions by talking.
- A large request is split and worked on by coordinated agents.
- Cost stays under control and visible.
- Agent-to-agent messages are never confused with the human-machine conversation, and never interrupt what the user is writing.

## Non-Goals
- Direct agent-to-agent chat that bypasses the application (rejected in decisions log §21).
- Agents approving anything, relaying approval, or moving canonical state.
- A Supervisor that executes code or starts Runs on its own.
- Cross-Waypoint dialogue in the first phase.
- Showing agent dialogues inside the user's Conversation stream.
- Workers creating, joining or accepting other Workers (ADR 0009:131 is unchanged).

## Functional Requirements
1. Ragnarok SHALL rename the "Waypoint parent" role to **Forger** in product language and documentation. Existing internal codes migrate in their own implementation slice.
2. The **Supervisor** SHALL receive a user request on a Project that already has a map and propose how to split it into new or changed Waypoints and their order. The proposal goes through a short Frame and becomes a new map revision only on the user's acceptance.
3. The Supervisor SHALL coordinate dialogue between the Forgers of linked Waypoints. Forgers of different Waypoints never talk directly.
4. The Supervisor SHALL commission deep reviews and architecture reviews (deciding when and their scope) and interpret their results. The code reading is done by read-only reviewer Workers (PRODUCT.md:100), and findings remain proposals for the user.
5. The Supervisor SHALL never change files, approve anything, or start a Run. Each Run still starts with the user's "Begin".
6. Within a Run, the **Forger** SHALL remain the only agent that splits work into tasks, merges results and proposes plan changes (ADR 0007:16, ADR 0009:131).
7. Workers SHALL belong to one of two families: **doers**, which may change files (design, front-end, tests, migration and so on), and **readers**, which only research or review and never change anything.
8. Agents SHALL exchange messages only through an application-mediated agent dialogue. Each message is free text with a minimal envelope: the recipient, the subject, and a closing state ("agreement", "no agreement" or "needs the human").
9. The Run plan approved by the user SHALL declare which agent pairs may talk (for example design↔front-end, reviewer↔builder) and their limits. Declared pairs may open a dialogue on their own; any other dialogue needs the Forger's admission within budget.
10. Dialogue SHALL draw on the Run's budget, in the existing units: tokens, turns, time and plan usage in subscription mode, plus money in API mode (ADR 0009:283-284). Each dialogue has its own limit, and exceeding it asks the user's authorisation.
11. A message SHALL reach another agent only as an Invocation context source marked "agent-authored, no authority".
12. A converged dialogue outcome SHALL become a typed proposal (options, a plan amendment, or a decision) that only the user approves.
13. Agent dialogues SHALL be shown in their own thread inside the Run overview, with each agent's mark and a style distinct from the user's conversation. The user's Conversation and Attention show only the outcome when it needs the user, with a link to the thread (PRODUCT.md:55).
14. The user SHALL be able to write into a dialogue thread at any time. The message is marked human, and it is delivered on each agent's next turn without interrupting one mid-turn. The user SHALL also be able to stop a dialogue.
15. Agent messages SHALL never enter or alter the user's composer, or anything the user is writing.
16. Plan changes discussed by agents SHALL follow two phases. While agents discuss (before any proposal exists), only the affected tasks stop at a safe point and the rest continues. Once the amendment proposal is submitted, ADR 0011 applies and no new work starts until the user decides. If the agents do not agree, they bring the conflicting positions, each side's arguments and a recommendation.
17. Dialogue SHALL arrive in phases. Phase 1 is inside one Run, under the Forger (reviewer↔builder first, then pairs such as design↔front-end). Phase 2 is across Waypoints, between Forgers coordinated by the Supervisor. The design accommodates both from the start.
18. Review dialogues SHALL follow the review round rule of the rpiv-method FRD: two rounds by default, then a user-approved third or fourth round only when serious findings remain.

## Non-Functional Requirements
- **Performance / cost**: every dialogue is bounded by its limit, the Run budget and loop-health detection (ADR 0009:97). The envelope's closing state lets the app end a dialogue and detect circling instead of relying only on message counts.
- **Security**: dialogue content is untrusted text, rendered as text and never parsed as markup. It carries no authority, and human approval is never relayed through it.
- **UX / Accessibility**: a distinct visual identity for agent dialogue, using agent marks (approved in decisions log §24) and a separate thread. Plain-text and keyboard parity apply.
- **Reliability**: messages are durable and attributed. A failed delivery or an exhausted limit is a distinct visible state, never silent loss.

## Constraints & Assumptions
- The user's mandatory limits (all four selected): cost under control; clear visual separation; never interrupt what the user writes; the user always has the last word.
- The rules in PRODUCT.md (the parallel-Workers bullet with the agent-dialogue sentence), ADR 0007, 0009, 0011, 0014 and 0015 stay in force, except where this FRD's design explicitly amends them through an ADR.
- Isolation stays: no shared checkouts, turn sequences or hidden memory between agents (ADR 0015).
- Today no agent-to-agent construct exists. Content moves only through fan-in results, remediation handoffs and Task-input snapshots (ADR 0007:55/63, 0014:98, 0015:37-38).
- Assumption, confirmed in teach-back: between Waypoints, Forgers talk only through the Supervisor.
- Assumption, confirmed in teach-back: the Supervisor's split goes through a short Frame before it becomes a map revision.
- Depends on: the basic Runs (not built yet) and Conversation C1.

## Acceptance Criteria
- [ ] The Run overview has an "Agent dialogue" thread where each message shows the author's agent mark, the recipient, the subject and the closing state, styled differently from the user's Conversation.
- [ ] A dialogue between a pair the plan does not declare does not start until the Forger admits it, which is visible in the thread.
- [ ] When a dialogue reaches its limit, Attention shows one item asking for authorisation with the cost so far. No further message is sent before the user answers.
- [ ] Typing in the Conversation composer while a dialogue runs never changes the composer content.
- [ ] A message the user writes in the thread appears marked "human", and the next agent turn includes it.
- [ ] A converged dialogue produces a proposal in Attention, and nothing changes until the user approves it.
- [ ] During an agent discussion of a plan change, only the affected tasks show "paused at safe point". After the proposal is submitted, the Run shows "waiting for your decision" and starts no new tasks.
- [ ] A Supervisor split proposal for an existing Project appears as a provisional map revision in Frame, and the map changes only after acceptance.
- [ ] The UI and the docs say "Forger" where they said "Waypoint parent".

## Recommended Approach
Add an Execution-owned agent dialogue record (durable, attributed messages with an envelope, a per-dialogue budget slice and a closing state) and a new Invocation context source kind ("agent-authored, no authority"). Declare permitted pairs in the Delegation plan (ADR 0011). Add a Supervisor role that produces Frame map-revision proposals and commissions reviews, and amend ADR 0007/0009/0011 and PRODUCT.md accordingly. Build phase 1 inside one Run first.

## Decisions

### Intent
**Question**: What problem do you most want coordination to solve?
**Recommended**: n/a — `intent` question
**Chosen**: All of it: less coordination done by the user, better results, and large requests split across agents.
**Rationale**: The user's own selection.

### Mandatory limits
**Question**: Which limits are mandatory?
**Recommended**: n/a — constraint gathering
**Chosen**: Cost under control; clear visual separation; never interrupt what the user is writing; the user always has the last word.
**Rationale**: The user's selection; it matches the stated concerns about cost, message mixing and collisions.

### Hierarchy
**Question**: Keep the Waypoint parent as the only supervisor inside a Run, with the Supervisor above it across Waypoints?
**Recommended**: Keep.
**Chosen**: Keep, and rename the Waypoint parent.
**Rationale**: evidence: ADR 0007:16, ADR 0009:131 + confirmed.

### Forger name
**Question**: Which name replaces "Waypoint parent"?
**Recommended**: Run lead.
**Chosen**: Forgemaster, then shortened by the user to "Forger" ("alias fica so forger").
**Rationale**: It fits the brand identity (the Runesmith's Instrument).

### Dialogue budget
**Question**: Do agent dialogues use the existing units and the Run budget?
**Recommended**: Yes, the same budget.
**Chosen**: Yes, the same budget, with a per-dialogue limit and user authorisation beyond it.
**Rationale**: evidence: ADR 0009:283-284 + confirmed.

### Message form
**Question**: Which form do agent messages take?
**Recommended**: Typed messages with short text.
**Chosen**: Free text, then (after one challenge) free text with a minimal envelope.
**Rationale**: It keeps the conversation natural while the app can detect the end and circling.
**Challenged**: Pure free text conflicts with the mandatory cost limit, because the app cannot tell when a dialogue ended or is circling. Alternative offered: free text plus an envelope (recipient, subject, closing state). Final call: free text with the envelope.

### Scope of dialogue
**Question**: Between whom can agents talk?
**Recommended**: Inside and across, in phases.
**Chosen**: Inside and across, in phases: inside a Run first, then across Waypoints through the Supervisor.
**Rationale**: A small first step, with the design ready for both.

### Who opens dialogues
**Question**: Who can open a dialogue?
**Recommended**: Declared in the plan.
**Chosen**: Declared in the plan. Other dialogues need the Forger's admission within budget.
**Rationale**: Predictable cost, known up front.

### Where dialogues show
**Question**: Where do agent dialogues appear?
**Recommended**: Their own thread plus a notice.
**Chosen**: Their own thread in the Run overview; only outcomes that need the user reach Conversation and Attention.
**Rationale**: evidence: PRODUCT.md:55 (Conversation is not an activity feed) + confirmed.

### User intervention
**Question**: Can the user join a running dialogue?
**Recommended**: Yes, by writing in the thread.
**Chosen**: Yes, by writing in the thread; messages are marked human and delivered without interrupting; the user can also stop the dialogue.
**Rationale**: The user keeps control without breaking agent turns.

### Supervisor power
**Question**: What does the Supervisor do, and what power does it have?
**Recommended**: Plans and coordinates; does not execute.
**Chosen**: Plans and coordinates; does not execute. It proposes splits as map revisions, coordinates Forgers and commissions reviews, and never edits code, approves or starts Runs.
**Rationale**: Keeps the user's "Begin" and approval authority.

### Deep and architecture reviews
**Question**: Who owns the deep and architecture reviews?
**Recommended**: The Supervisor commissions; reader Workers read.
**Chosen**: The Supervisor commissions; reader Workers read; the user decides.
**Rationale**: evidence: PRODUCT.md:100 + confirmed. It also follows the user's sketch that these reviews belong to the Supervisor, not to a Worker.

### Worker families
**Question**: Split Workers into doers and readers?
**Recommended**: Yes, two families.
**Chosen**: Yes, two families.
**Rationale**: It mirrors rpiv (almost all subagents are read-only) and makes permissions clear.

### Plan changes during discussion
**Question**: How do we reconcile agent discussion of plan changes with ADR 0011?
**Recommended**: Two phases.
**Chosen**: Two phases. During discussion only the affected tasks stop; once a proposal is submitted, ADR 0011 applies until the user decides; on disagreement the agents bring the positions and a recommendation.
**Rationale**: It resolves the conflict with ADR 0011 and PRODUCT.md:105 without amending the dispatch-closing rule for submitted proposals.

## Open Questions
- Numeric defaults (messages per dialogue, per-dialogue budget slice) are evidence-driven, as with other budgets (ADR 0009:158).
- How the envelope's closing state is produced and validated (by the agent, or derived by the app) — for design.
- Phase 2 details: how the Supervisor runs a cross-Waypoint dialogue when the Waypoints have different Runs, epochs and budgets.

## Suggested Follow-ups
- Rename "Waypoint parent" to "Forger" in PRODUCT.md, CONTEXT.md and the ADRs (documentation), and later in code identifiers such as `WAYPOINT_PARENT_MODEL_UNAVAILABLE` (an implementation slice).
- Add the terms agent dialogue, Supervisor, Forger and Worker family to CONTEXT.md.
- The review round rule (two plus user-approved extras) needs an ADR 0014/0011 note (see the rpiv-method FRD, #100).

## Glossary
| Term | What it means here |
|---|---|
| Supervisor | The agent above the Runs: it proposes how to split a request across Waypoints, coordinates Forgers and commissions reviews; it never executes or approves. |
| Forger | The agent that leads one Run (formerly "Waypoint parent"): it splits tasks, merges results and proposes plan changes. |
| Worker family | Doers (may change files) or readers (only research and review). |
| agent dialogue | A conversation between agents that goes through the app: recorded, attributed, budgeted, without authority. |
| envelope | Three marks on each agent message: recipient, subject and closing state. |
| closing state | "agreement", "no agreement" or "needs the human", which tells the app a dialogue has ended. |
| safe point | A moment where an agent can stop without leaving work half-done (ADR 0009). |
| Invocation context source | An item the app puts into an agent's input, recorded with its origin and trust. |

## Shared Understanding
**Agreed model (in the developer's words):** You make a request → the Supervisor proposes how to split it (through Frame, as a new map version that you approve) and coordinates → each Waypoint's Forger leads its Run with doer and reader Workers → agents talk through the app, in free text with an envelope, inside the Run first and across Waypoints later, within the Run budget, in their own thread, and you can write into it or stop it → whatever they agree becomes a proposal only you approve → plan changes pause only the affected work while agents discuss, and everything waits for you once the proposal arrives.

**Corrected during teach-back:** nothing — the model was confirmed as first stated.

**Residual uncertainty (accepted):** Forgers of different Waypoints talk only through the Supervisor. The Supervisor's split goes through a short Frame. Both were confirmed.

## References
- `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §21 (mediated agent dialogue), §24 (agent marks)
- `PRODUCT.md:55`, `:61`, `:100`, `:103`, `:105`, `:109`
- `docs/adr/0007` (:16-18, :55, :63, :71), `0009` (:26, :45, :48, :97, :130-131, :283-284), `0011` (:85-91, :126-129, :167-169, :190-192), `0014` (:80-109), `0015` (:30, :37-38, :199)
- GitHub #99 (agent collaboration), #100 (rpiv-method FRD), #98 (decision links in Run context)
- `.rpiv/artifacts/discover/2026-10-09_18-03-55_rpiv-method-in-ragnarok.md`
