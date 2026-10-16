# ADR 0022: Decision Scope, Implementing Waypoints And Decisions In Run Context

- Status: Accepted (2026-10-09); amended 2026-10-16 (see Amendment 1, Accepted)
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

## Amendment 1: Retirement, Wording-Only Revisions, Echoes And The Decision-Change Item

- Status: Accepted (2026-10-16)
- Date: 2026-10-16
- Decision owners: Pedro Mesquita
- Issue: [#99](https://github.com/TheMastermindPT/slopstop/issues/99)
- Design: `.rpiv/artifacts/designs/2026-10-16_17-36-22_cross-waypoint-dialogue-and-decision-staleness.md` (Architecture F; G10-G12, G15)
- Decisions log: `.rpiv/artifacts/evidence/2026-10-05_conversation-decisions.md` §90-§98

Line references in this amendment (`:N`) point to the text of this ADR as accepted before the amendment (commit `1b2256a`). Every decision above stays in force except where a rule below names the sentence it changes.

### Amendment Context

The user decided (decisions log §90, §92) that a changed or retired decision stops outdated memories from reaching agents, that every document repeating the decision is listed, and that one Attention item replaces the per-Run items of :49. ADR 0017 Amendment 1 binds Memory to a decision's meaning version; this amendment defines that meaning version, retirement, the echo record, the change-time search and the single decision-change item.

### Sentences This Amendment Changes

- :34-35: a retired decision has a current row but no in-force revision; context selection excludes it with the recorded exclusion reason `retired`.
- :36 and :48: pinned Runs keep their pinned revisions, including a pin on a decision retired later.
- :48 ("nothing pauses or changes automatically"): a decision edit itself still pauses nothing. A meaning-changing revision or retirement may trigger the conflict detector (ADR 0021 Amendment 1), and a cross-Waypoint dialogue that follows may hold only the affected tasks, through a coordinator-admitted typed Forger hold proposal (ADR 0011 Amendment 1) (decisions log §97, K7).
- :42: the Supervisor receives every Foundation section in its Run-absent context (ADR 0021 Amendment 1).
- :43: "a read-only Worker infers each section from the code" becomes: the **Run-absent read-only Project agent** (ADR 0021 Amendment 1) infers each section from compiled context over a `decision-search-capture`, paid by the Project coordination reserve; the user still confirms section by section.
- :49 is **superseded** by "The single decision-change item" below.
- :50 is extended: the change-time search outcomes below follow the same rule, and "checking" and "not checked" never look like "no documents found".

### Retirement

- Retirement is a new Accepted **retirement revision** with no in-force content; the current pointer advances to it, and the current row's archive state is denormalised from it (ADR 0006:33).
- A retired decision is excluded from context selection with reason `retired`. Pinned Runs keep their pin. Bound memories become effectively stale (ADR 0017 Amendment 1).
- **Restore** creates a successor revision from earlier content (ADR 0006:36) and always increments the meaning version.

### Meaning Version And "Wording Only"

- Each revision stores a `meaning_version`. It increments on every revision except one the user marks **wording only**; that revision keeps its predecessor's meaning version and records an immutable, user-attributed `wording-only-of` link to its predecessor (the precedent of reuse links, ADR 0006:90, computed there and user-asserted here).
- The mark is refused with `DECISION_WORDING_ONLY_NOT_APPLICABLE` when the predecessor is retired, or when the scope (:21) or the implementing set (:22) differs in any way. Retirement and restoration never carry it.
- Only the user's direct edit command on the Decisions page can set the mark. No Supervisor proposal, Decision checkpoint, decision follow-up proposal or agent message has a field for it (:28, :54).
- A wording-only revision emits no `decision-current-meaning-replaced` event, stales no memory, flags no document, runs no search and raises no per-Run row. The mark stays in the decision history.
- **"Mark as meaning changed"** corrects a mistaken mark: it creates a new unmarked revision with the same text and runs the full change path.

### Decision Echo Record

- A **decision echo** records that a document repeats an accepted decision revision. It is recorded at the **Integration application proof**, the only point where text reaches the user's working tree (ADR 0015:97).
- A doer Worker's result declares attributed, untrusted echo claims: a decision revision plus a location (ADR 0015:48, :50). Composition carries them into the Candidate manifest (ADR 0015:62).
- After an `applied` proof, the idempotent `RecordDecisionEchoes`, keyed by proof id and claim position, accepts only claims inside the proof's changed paths. Integration never writes decision or echo state.
- Location identity is a Compound code anchor on the `integration-target` Evidence scope, never a path (ADR 0015:21). Echo states are `current`, `moved`, `missing` and `anchor-unresolved`; a failed anchor keeps the echo at document granularity and never drops it.
- Echo rows hold ids, hashes and the anchor only: no decision text, excerpt or path in events or diagnostics (ADR 0006:116; ADR 0017:39, :100).
- Echoes are navigation only; they grant no trust. Commit trailers (:60) stay as the commit-level complement.
- Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8). Echo granularity and the recording moment are provisional.

### Change-Time Search

- On a meaning-changing revision or a retirement, a two-pass search lists documents that may repeat the decision:
  - The capture is the strictly local `decision-search-capture` of the Integration target (ADR 0010 and ADR 0015 notes); onboarding requests the same capture for Foundation inference (:43). Its limits are fixed by an ADR 0019 direct limit owner (ADR 0019 note).
  - **Pass 1:** a deterministic owner-specific observer (`PRODUCT.md`: deterministic owner-specific observers keep their own producer identity) runs a literal and identifier scan of the `decision-search-capture` content Artifact, at no model cost.
  - **Pass 2:** the Run-absent read-only Project agent judges paraphrases over compiled context from the same capture, paid per ADR 0021 Amendment 1.
- The design's "read-only Worker" for this search is refined to that agent (decisions log §94, R17).
- **Outcome vocabulary.** This amendment owns the decision-search outcomes, which mirror but do not extend ADR 0017:96: `pending`, `complete`, `empty`, `truncated`, `failed` and `not-run(reason)`. `empty` requires a complete scan. Nothing but `empty` may display as "no documents found" (:50). ADR 0017:96 is unchanged.
- No stored full-text index is added (ADR 0006:137 unchanged).
- Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8). The two search passes and their funding are provisional.

### The Single Decision-Change Item

- One Attention item per decision, keyed by decision id over its unresolved change events. Repeated changes fold into one item targeting the current meaning version. It is a direct projection, not a stored status (ADR 0017:101-102).
- **Row rule.** A row holds exactly one decision point with its listed alternatives, or is information-only.
- Rows:
  - one per pinned nonterminal Run whose epoch pins an older meaning version, with the alternatives "Ask the Forger for an amendment proposal" (the action of :49, now per Run) or "Keep the earlier version for this Run";
  - stale memories, information only, linking to the Memory library (Memory Proposals still never create Attention);
  - echoes and search candidates with each pass's outcome, information only; plus a search row with the alternatives "Retry search" or "Proceed without search" while a pass is `failed` or `not-run`;
  - one row for the Supervisor's proposed update, with the alternatives approve or decline;
  - one "Begin update Run" row per host Waypoint after approval, with the alternatives "Begin update Run" or "Skip this Waypoint".
- **Row answers** are owned by the decision owner in `decision_change_row_answers` (keep, undo keep, proceed without search, retry, skip, undo skip), except two answers whose owner record is elsewhere: the update row's approve or decline is the decision owner's immutable `decision_follow_up_proposal_decisions` row, and a begun update Run is the Execution-owned Run created by the user's `BeginAction`, linked to the follow-up proposal in `decision_follow_up_run_links`. The decision owner's idempotent `LinkDecisionFollowUpRun`, keyed by Run id, writes that link after `BeginAction` settles with the follow-up proposal as provenance; Execution never writes decision state. A row resolves when:
  - Run row: the Run is terminal, its epoch pins the current meaning version, or the user kept the earlier version;
  - stale-memory and echo or candidate rows (information only): when the item resolves;
  - search row: both passes are complete, or the user proceeds without search;
  - update row: a `decision_follow_up_proposal_decisions` row records approve or decline;
  - "Begin update Run" row: a linked update Run exists for that host Waypoint, or the user chose "Skip this Waypoint".
- The item resolves when every row with a decision point is resolved and no search pass is `pending`; while a pass is pending the item stays open and shows "checking".
- No item exists when the change has no dependants and both passes are complete and `empty`. While a pass is pending the item shows "checking". A load failure never shows as an empty list. The rail counts items, not rows. The refinement "one exact action per row" is recorded in decisions log §93 (G11).
- Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8). The item's row layout and resolution actions are provisional.

### Update Work

- The Supervisor's output is a typed **decision follow-up proposal**, a new kind under ADR 0021:45, in three groups:
  - pinned Runs use the per-Run amendment path;
  - memory re-verification is proposed as a `memory-propose` reader task in an update Run, and each resulting Memory Proposal still needs the user's acceptance (ADR 0017:135);
  - document updates need doer Workers in a Run.
- Memory and document work use the same **host rule**: an existing host Waypoint (implementing Waypoints first, then the scope Waypoint) through the user's `BeginAction` with cause `ACTION_SELECTED`; or, with no host (always for a Project-scope decision), a docs-update Waypoint the Supervisor proposes in a map revision, in the scope Strand or one the user picks.
- The user acts at every authority step: map acceptance, Begin and Run approval. The Supervisor starts nothing.
- Provisional: binding now; revisited only when Pedro asks (decisions log §93, C8). Update-work hosting is provisional.

### Provisional Scope

Only the clauses labelled above, plus ADR 0017 Amendment 1's Evidence floor and ADR 0011 Amendment 1's joint-only closure, are provisional. These safety invariants are **never provisional**: decision revisions as mandatory Memory dependencies; effective stale at read; stale terminal; retirement as a revision; the wording-only mark is user-only, and scope or link edits are never wording-only; a failure never displays as "none found"; and privacy (no decision text, excerpt or path in events, rows or diagnostics).

### Records

The decision owner's family (ADR 0006 note) gains: revisions with `meaning_version` and a closed revision kind (`content | retirement`); `decision_revision_wording_only_links`; the scope and implementing children of :21-22; `decision_current_meaning_replacement_events` (the typed child of ADR 0017 Amendment 1's event); `decision_echoes`; `decision_echo_searches` and `decision_echo_search_candidates`; `decision_change_row_answers`; `decision_follow_up_proposals`, `decision_follow_up_proposal_decisions` and `decision_follow_up_run_links`.

These rows, the change event child, the echo search candidates and the diagnostics this amendment owns hold identities, versions, hashes and anchors only: no decision text, excerpt or path.

### Diagnostics

This amendment owns `DECISION_WORDING_ONLY_NOT_APPLICABLE` and the search outcomes above. A search pass that cannot run is `not-run(reason)`; one that fails is `failed`; neither reads as "no documents found".

### User Actions And Their Undo

Under the undo rule of ADR 0021 Amendment 1 (a reversal is a new recorded action or revision; the spent-budget rule applies):

| User action | Undo or reversal (where it lives) | Not reversible (reason), confirm first |
| --- | --- | --- |
| Edit a decision without the wording-only mark | A new edit can restore the text (Decisions page); the mark cannot be added afterwards | Bound memories go stale for good (ADR 0017:61); confirm, naming the memories, echoes and pinned Runs |
| Accept a Supervisor decision revision in a Decision checkpoint | As above | As above |
| Wording-only mark | "Mark as meaning changed" (Decisions page, decision history) | Until undone, dependants stay trusted; confirm, naming them |
| "Mark as meaning changed" | None | Memories that went stale stay stale; documents stay listed; confirm, naming dependants |
| Retire a decision | Restore (Decisions page) | Bound memories stay stale after a restore; confirm, naming dependants |
| Restore a retired decision | Retire again (Decisions page) | A new meaning version re-runs the change path (search, item, Run rows); confirm, naming pinned Runs |
| "Keep the earlier version for this Run" | "Undo keep" (Run overview; the row returns while the Run is nonterminal) | None |
| "Undo keep" | "Keep the earlier version" again (Run overview) | None |
| "Ask the Forger for an amendment proposal" (per-Run row) | None | A single-Run amendment closes all Run dispatch until the user decides (ADR 0011:131); confirm |
| Approve or decline the Supervisor's proposed update | Decline: "Ask again" (decision history). Approve: Runs it leads to are cancelled through Run controls; a docs-update Waypoint is removed by a map revision | Work already integrated stays integrated; confirm approval |
| "Ask again" (a new follow-up proposal) | Decline the new proposal (decision history) | Spent budget |
| "Proceed without search" | "Retry search" (decision history) | None |
| "Retry search" | None | Spent budget |
| Begin an update Run | Cancel the Run (existing Run controls) | None |
| "Skip this Waypoint" (Begin update Run row) | "Undo skip" (decision history; the row returns) | None |
| "Undo skip" | "Skip this Waypoint" again (decision-change item) | None |
| Accept a map revision adding a docs-update Waypoint | A new map revision archives the Waypoint while it has no Run; with a Run, cancel it first (map view) | None |

### Amendment Consequences

- A changed or retired decision stops outdated memories from reaching agents at once, and the user sees one item per decision listing everything that depends on it.
- Small wording fixes stay cheap: the user's wording-only mark keeps memories trusted and raises nothing.
- The Decisions page gains the wording-only mark, "Mark as meaning changed", Retire and Restore; Attention gains the decision-change item.

### Amendment Rejected Alternatives

- Retirement as archive state only: a pointer comparison would pass silently.
- A Supervisor- or agent-settable wording-only mark: it would let a model suppress staleness.
- Recording echoes at Worker result time: the text has not reached the user's working tree yet.
- One Attention item per Run (the old :49): it splits one decision's consequences across many items.
