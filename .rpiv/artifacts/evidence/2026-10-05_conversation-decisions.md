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
