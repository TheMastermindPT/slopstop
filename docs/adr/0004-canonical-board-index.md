# ADR 0004: Canonical Board Index

- Status: Accepted
- Date: 2026-08-26
- Decision owners: Pedro Mesquita

## Context

Each Waypoint needs one durable collaboration history across attempts and revisions, while direct model conversations, Execution events, and Frame presentation retain separate ownership. A copied activity feed would create another content authority; independent Waypoint sequences would make Project aggregation, pagination, and unread state ambiguous; timestamp ordering would reorder delayed events. The canonical layer therefore needs a minimal index that supplies durable identity and order without absorbing source payloads.

## Decisions

- Store one append-only Project-wide Board order. Every Board entry has an opaque `BoardEntryId`, a separate monotonic Board position assigned by the canonical writer, and exactly one `WaypointId`. Waypoint Boards and the Project activity feed are projections over that shared order.
- Let a Board entry reference either an immutable message in that Waypoint's conversation graph or a versioned typed event produced by Execution. The primary Project conversation never enters Board. Conversation owns message content, Execution owns event production, and Frame owns labels, grouping, collapsing, and visual or plain-text presentation.
- Persist only structural index metadata: source kind, stable source identity and version, Waypoint, Board position, source and acceptance times, source ordering and attribution when available, admission-policy version, Project-feed eligibility, and an optional superseded-entry reference. Do not copy message bodies, event payloads, summaries, or display text into Board.
- Give Board a versioned admission policy. It decides which typed event references are Board-visible and which approved typed-event entries are Project-feed eligible; conversation-message references remain Waypoint-only. Stamp the policy version and decision at admission; later policy versions affect only new entries unless an explicit correction supersedes an old entry. Raw logs and process output are not Board entries.
- Register entries through idempotent Typed commands settled by the active Project writer. The same source reference creates at most one Board entry. Producers cannot allocate Board identity or order, choose visibility, or write the index directly. Canonical acceptance order controls the timeline; delayed sources retain their original time and sequence only as provenance.
- Correct an entry by appending a new entry that supersedes the current chain head. The command requires the expected head, chains remain linear, and a stale concurrent correction is a visible conflict rather than a branch or overwrite. The index preserves the full chain; Frame may collapse it without hiding the audit path.
- Page with versioned keyset cursors bound to Project, scope, filters, direction, and the query's initial upper watermark. Offset pagination is unsupported. New entries require refresh and never cause an in-progress traversal to skip or repeat older entries. Invalid or incompatible cursors fail explicitly instead of restarting or returning an empty page.
- Keep one monotonic read position for the Project activity feed and one for every Waypoint Board in v1. Advance it only through an idempotent Typed command after the client confirms the highest contiguous position presented in an unfiltered chronological view. Filtered views do not advance it implicitly. Read-position changes remain canonical and auditable but are excluded from Board admission.
- Resolve each source reference as `available`, `source-unavailable`, `source-missing`, `source-incompatible`, or `source-broken`. An unresolved source leaves its index entry visible with an exact diagnostic; it never degrades to absent or clean.
- Retain Board entries for the Project lifetime in v1. Archiving a Waypoint makes its Board read-only without removing entries, positions, correction chains, or read state. Automatic deletion, compaction, numeric page limits, and archival thresholds require measured Evidence and separate decisions.

## Consequences

- One canonical order supports deterministic Waypoint timelines, Project aggregation, pagination, resume cursors, and unread counts without making Board a fourth content graph.
- Runtime reset or source failure can reduce available detail but cannot erase the fact, order, provenance, or failure state of an indexed entry.
- Canonical writes increase because entry registration, correction, and read acknowledgement cross the Project writer, but authority and idempotency remain explicit.
- Physical tables, indexes, cursor encoding, measured limits, migration, backup, and restore behavior remain for the physical persistence and migration decisions; this ADR fixes only the logical ownership contract.
