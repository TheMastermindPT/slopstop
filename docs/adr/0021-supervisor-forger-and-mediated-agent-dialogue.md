# ADR 0021: Supervisor, Forger And Application-Mediated Agent Dialogue

- Status: Accepted (2026-10-09)
- Date: 2026-10-09
- Decision owners: Pedro Mesquita
- Issue: [#99](https://github.com/TheMastermindPT/slopstop/issues/99)
- FRD: [Agent coordination and dialogue](../../.rpiv/artifacts/discover/2026-10-09_18-03-55_agent-coordination-and-dialogue.md)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §21, §25, §27

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
