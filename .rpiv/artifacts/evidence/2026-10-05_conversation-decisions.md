---
date: 2026-10-05
author: coordenador-claude (Claude Code), for Pedro Mesquita
repository: slopstop
status: in-progress
tags: [conversation, decisions, context, waypoint]
---

# Conversation — Human Decisions

Baseline: the decisions recorded in `PRODUCT.md`, `discover/2026-08-22_19-18-10_workspace-supervision-experience.md` (FR23–FR49), ADR 0006, ADR 0004 and ADR 0009 Amendment 1 stay in force. This log adds the decisions taken while preparing Conversation planning.

## 1. Project conversation context about Waypoints (2026-10-05)

- **Gap closed.** The recorded rules defined the Waypoint-target context packet (FR26) but not what a Project-scoped message carries about Waypoints. In subscription mode Conversation has no tools, so the model only knows what SlopStop sends.
- **Level 1, always.** Every Project-scoped message carries a compact canonical status of the Project's Waypoints: objective, status, accepted decisions and approved typed Execution events. When the set is too large, SlopStop sends the active or changed Waypoints and the Context record lists every omitted Waypoint; nothing is omitted silently.
- **Level 2, on explicit request.** A summary of a Waypoint's conversation enters a Project-scoped message only when the user asks for it, as a declared scope expansion that needs confirmation (FR48). How and when summaries are produced is decided later; a model-produced summary is its own recorded invocation.
- **Level 3 rejected.** Full Waypoint conversation transcripts never enter the Project conversation.
- Waypoint and Project conversation histories stay separate (FR45). Neither conversation controls the other; information moves through accepted decisions (canonical state) or explicit, confirmed attachment.

## 2. Talking about Waypoints from the Project conversation (2026-10-05)

- **Problem raised by the user.** Entering each Waypoint conversation for every change means many jumps between many Waypoints.
- **Accepted: one place to talk, the destination always visible.**
  - The Project conversation is the default place to write.
  - When a request concerns concrete Waypoint work, the model may *suggest* a destination ("This concerns Waypoint X. Send it there?"). The user confirms or corrects it; nothing is routed silently.
  - A message sent to a Waypoint is stored in that Waypoint's conversation, so its history stays focused. The Project conversation keeps a short linked line.
  - The user enters a Waypoint conversation only for long, focused discussion.
  - Changes to an accepted plan stay reviewed proposals; changes to running work use the existing Run amendment flow.
- **Amends FR24.** Scope is never inferred *silently*: a model-suggested destination is allowed only as a visible suggestion the user confirms.
- **Explicit Waypoint references.**
  - On the map, a Waypoint's menu offers to put it into the composer as a removable reference chip.
  - In the composer, typing `@` opens a searchable picker (keyboard equivalent), as in code editors. The same picker can later list other attachable items (files, selections), shown with distinct type markers.
  - A chip makes the destination explicit, so no model guess is needed.
  - Proposed split, to confirm when the slice is planned: "Mention" (talk about the Waypoint in the Project conversation; its detailed status joins the context) versus "Send to" (the message goes to the Waypoint's conversation).
- **Timing.** Waypoint references arrive with the slice that builds the map and Waypoints (after Frame), not with the first Conversation slice. The `@` picker for files follows the attachments work.

## 3. First-slice choices and the `@` convention (2026-10-05)

- **Accepted (user, "Sim, aceito"):**
  1. First slice: save and reopen Conversation messages with no model; the real model follows in the next slice.
  2. Subscription-mode model: Opus by default, with a visible per-message choice the user can change.
  3. History sent per turn: the most recent messages up to a size limit, in a stable append-only order; automatic summaries later.
  4. Responses stream progressively and can be cancelled mid-turn.
- **`@` is reserved for files** (supersedes section 2's use of `@` for Waypoints). Its behaviour follows current industry practice; when the attachments slice is planned, research VS Code chat and Claude Code `@` file references first and bring the details to the user.
- **Waypoint references need another trigger.** Proposed: `#`, as GitHub uses for issues. Pending the user's confirmation.
