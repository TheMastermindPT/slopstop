---
date: 2026-10-07
author: coordenador-claude (Claude Code), for Pedro Mesquita
topic: "Product ideas of high value to developers (kept by the user)"
tags: [ideas, proposals, product]
status: proposal
---

# Product ideas kept by the user (2026-10-07)

## Status and rules

- **Not decided.** The user asked to keep these six of ten proposals for later. None of them is a requirement or a contract.
- **Model proposes, user approves.** Each idea follows the standing rule: model output only proposes, and user decisions are durable typed records.
- **When to raise them.** Bring each idea to the user when the area it belongs to is designed.

## 1. "Why does this line exist?" (decision provenance)

- **The idea:** from any changed line, show the full chain behind it: Waypoint → Run → Worker → Worker result → Evidence that validated it → Candidate user review → Integration approval.
- **It is like:** `git blame` (which shows who last changed each line), but it answers *why* instead of *who*.
- **Builds on:**
  - immutable Accepted revisions and typed decisions (ADR 0002);
  - Candidate and Integration application proofs (ADR 0015);
  - Evidence lineage (ADR 0010).
- **Value:** months later, the reason for any code is one click away. It is a differentiator, because only SlopStop records this chain.

## 2. Return briefing

- **The idea:** when the developer comes back, show what changed since they left: work finished, work failed, work waiting for them. It is ordered by urgency.
- **Source:** canonical records and Board/feed read positions, not a model summary.
- **Builds on:**
  - Board read positions and the Project activity feed (PRODUCT.md);
  - Attention.
- **Value:** resuming takes seconds instead of reading transcripts.

## 6. Side-by-side alternatives

- **The idea:** run the same Waypoint from the same starting point with two models or two plans, then compare the two Candidates on Evidence, size and cost. The user picks one; the other is archived.
- **Builds on:**
  - Candidate versions and evaluations;
  - Run supersession;
  - Run-workspace isolation.
- **Open question:** how two Runs relate given the Run slot rule (one non-terminal Run per Waypoint). This needs a design decision.
- **Value:** choose models and approaches from facts in your own code.

## 7. Personal model evaluation on your own Project

- **The idea:** replay finished Waypoints with frozen inputs (Task input snapshots, accepted contracts) against other models or adapters. Measure which cheaper model would pass the same Evidence.
- **Builds on:**
  - Sealed invocations and Invocation context records (ADR 0009);
  - Evidence rules (ADR 0010, 0012);
  - the scripted-provider idea in `2026-10-07_oh-my-pi-and-prime-agent-inspiration.md`.
- **Value:** know whether a cheap model is good enough for *your* code, without trusting generic benchmarks.

## 8. Your corrections become rules

- **The idea:** when the developer rejects work or requests changes repeatedly for the same reason (for example "no `any`" or "use Effect"), the system proposes a deterministic, checkable rule.
- **Once accepted:** the rule guards Workers. It is enforced at the tool boundary and each hit is recorded as a Finding.
- **Never** auto-applied; never model-judged.
- **Builds on:**
  - Candidate change requests;
  - Finding (ADR 0014);
  - the TTSR idea in the inspiration note.
- **Value:** stop repeating the same correction; the tool improves with the developer's approval.

## 9. "Take the wheel"

- **The idea:** pause a Worker, open its isolated worktree in the developer's editor, edit by hand, then hand back.
- **The human edit** is recorded as an attributed human change (it is not silently absorbed). The Worker continues from that state.
- **Builds on:**
  - Run pause and resume through Control requests;
  - Worker deltas and attribution;
  - mutation leases (ADR 0008);
  - external changes invalidate attribution instead of entering a Worker result silently (PRODUCT.md).
- **Open question:** how a human edit is attributed and leased. This needs a design decision.
- **Value:** two minutes of human work can save twenty minutes of agent retries, without choosing all-manual or all-AI.

## Not kept

The user did not keep ideas 3, 4, 5 and 10:

- 3: review by intent;
- 4: slop detector before review;
- 5: cost forecast before approval;
- 10: risk map for review.
