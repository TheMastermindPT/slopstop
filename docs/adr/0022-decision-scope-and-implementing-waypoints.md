# ADR 0022: Decision Scope, Implementing Waypoints And Decisions In Run Context

- Status: Accepted (2026-10-09)
- Date: 2026-10-09
- Decision owners: Pedro Mesquita
- Issue: [#98](https://github.com/TheMastermindPT/slopstop/issues/98)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §15, §18, §20, §27

## Note (2026-10-10): former names

This ADR uses "Feature", the former name of **Strand** (decisions log §30; see `CONTEXT.md` Former Names). The two names denote the same concept; this note changes no decision.

## Context

Accepted product and plan decisions are immutable Accepted revisions with a current pointer (CONTEXT.md, ADR 0006). The user decided that the central Decisions page lets them add, edit in place and retire decisions, and that the map shows decisions in relation to Waypoints. The current Frame protocol has no persisted relation between a decision and the map. ADR 0009 requires every agent's input to be an explicit, recorded Invocation context record, so which decisions an agent receives must be a rule, not an inference.

## Decisions

### Two separate links

- Each accepted decision revision records its **scope**: exactly one of the Project, one Feature, or one Waypoint.
- Each accepted decision revision records zero or more **implementing Waypoints**: Waypoints explicitly linked as planned work that realises the decision.
- Scope and implementing Waypoints are separate relations. Neither is ever inferred from the conversation a decision came from, nor from a `blocks` relationship.
- A decision spanning several Waypoints stays one record with several links, never separate copies.

### Who creates the links

- The Supervisor (ADR 0021) proposes a scope when it proposes a decision, and proposes implementing Waypoints when it proposes a split into Waypoints. Both appear in the Decision checkpoint and in the map-revision proposal; the user accepts or corrects them.
- The user can change scope and links later on the Decisions page. Each change creates a new attributed Accepted revision and keeps history.
- Direct adds and edits on the Decisions page record provenance "added/edited by you here"; an original conversation stays historical provenance only.

### Decisions in Run context (amends ADR 0009 source selection)

- The Invocation context record of a Forger or Worker includes the current revisions of: every Project-scope decision (including the Foundation section), every decision scoped to its Feature or Waypoint, and every decision its Waypoint implements.
- All other decisions are excluded, each with a recorded exclusion reason, and remain reachable only through read-only typed retrieval.
- A Run pins the decision revisions current when its policy epoch was approved (ADR 0011).

### Foundation sections by role

- Project-scope Foundation decisions (stack, repository structure, conventions) are organised in sections: **Common** plus one section per Worker role in use (for example Front-end, Back-end/data, Tests, Design, Security, Docs, Migration). A Project shows only the sections it uses.
- A Worker receives the Common section plus the section for its role, in addition to its Feature, Waypoint and implemented decisions. It does not receive other roles' sections; it may read them through read-only typed retrieval, which is recorded.
- A reviewer receives Common plus the section of the work it reviews. The Forger and the Supervisor receive every section.
- New Project: the opt-in foundation quiz asks per section, only for sections the Project uses. Existing Project: a read-only Worker infers each section from the code, and the user confirms section by section.
- Foundation sections live on the Decisions page (a Foundation section), never in the Memory library (PRODUCT.md: accepted decisions are not duplicated as Verified Memory).

### A decision edited during an active Run (amends ADR 0011 triggers)

- The Run keeps its pinned revisions; nothing pauses or changes automatically.
- When a pinned decision gets a new current revision, Attention shows one item ("Decision changed: Run N uses the earlier version") with an action asking the Forger for a Run amendment proposal, which the user approves or rejects.
- Editing a decision on the Decisions page shows an advisory, non-blocking note when it may contradict another decision or a linked plan; "checking" and "not checked" never look like "no conflicts". A save never rewrites other decisions, plans, running work or code.

### Acceptance

- Proposed decisions are shown grouped in their checkpoint; each is accepted on its own or with Accept all, or corrected in conversation. There is no Reject. Attention keeps one item per checkpoint until its last decision is accepted.

## Consequences

- The canonical store gains scope and implementing-Waypoint relations on decision revisions, plus direct add/edit/retire commands; the Frame protocol and Decisions page projections expose them.
- The map shows counts of current linked decisions and a "Show on map" focus that highlights implementing Waypoints without changing the layout.
- Commits prepared by Ragnarok carry the justifying decision revisions in trailers (PRODUCT.md integration rule).

## Rejected Alternatives

- Scope only, or implementing Waypoints only: each loses part of the meaning ("applies to the whole Project" versus "this work realises it").
- Manual links only: laborious and easy to forget.
- Automatic links without confirmation: a wrong link silently changes what agents receive.
- Sending every decision to every agent: large contexts and cross-area confusion.
- Pausing a Run automatically on any decision edit: interrupts work for small edits.

## References

- ADR 0006, ADR 0009, ADR 0011, ADR 0021
- PRODUCT.md (Decisions page, Decision checkpoint, integration commits)
- GitHub #98, #104
